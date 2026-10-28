import { pages } from "../deploy/pages.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, readdir } from "node:fs/promises";
import vm from "node:vm";

const bundle = new URL("../deploy/dist/", import.meta.url);
const prepaint = await readFile(
  new URL("../.build/browser/intro-prepaint.js", import.meta.url),
  "utf8",
);

function intro(
  storage: Record<string, string>,
  options: { blocked?: boolean; reload?: boolean; search?: string } = {},
) {
  const window = {} as Pick<Window, "__fixmycitySkipIntro">;
  const classes = new Set<string>();
  vm.runInNewContext(prepaint, {
    window,
    URLSearchParams,
    Date,
    location: { search: options.search || "" },
    document: {
      documentElement: {
        classList: { add: (value: string) => classes.add(value) },
      },
    },
    sessionStorage: {
      getItem: (key: string) => {
        if (options.blocked) throw new Error("Blocked");
        return storage[key] ?? null;
      },
    },
    performance: {
      getEntriesByType: () => [
        { type: options.reload ? "reload" : "navigate" },
      ],
    },
  });
  return {
    skip: window.__fixmycitySkipIntro,
    hidden: classes.has("intro-seen"),
  };
}

test("a fresh visit plays the intro", () => {
  assert.deepEqual(intro({}), { skip: false, hidden: false });
});
test("a quick return skips the intro before the first paint", () => {
  assert.deepEqual(
    intro({
      "fixmycity-intro-seen": "1",
      "fixmycity-last-active": String(Date.now() - 60000),
    }),
    { skip: true, hidden: true },
  );
});
test("a return after five minutes replays the intro", () => {
  assert.deepEqual(
    intro({
      "fixmycity-intro-seen": "1",
      "fixmycity-last-active": String(Date.now() - 301000),
    }),
    { skip: false, hidden: false },
  );
});
test("blocked storage still skips the intro on reload", () => {
  assert.equal(intro({}, { blocked: true, reload: true }).skip, true);
  assert.equal(intro({}, { blocked: true, reload: false }).skip, false);
});
test("the build inlines compiled prepaint and ships compiled intro code", async () => {
  const index = pages["index.html"];
  const introHTML = pages["intro.html"];
  assert.ok(index.includes(prepaint));
  assert.ok(!index.includes("<!-- INTRO_PREPAINT -->"));
  assert.match(introHTML, /<script src="intro\.js"><\/script>/);
  for (const html of [index, introHTML]) {
    for (const match of html.matchAll(/<script[^>]*src="([^"]+)"/g)) {
      assert.ok((await stat(new URL(match[1], bundle))).isFile(), match[1]);
    }
  }
});
test("all service worker precache entries exist in the deployed bundle", async () => {
  const worker = await readFile(new URL("service-worker.js", bundle), "utf8");
  const files: string[] = [];
  vm.runInNewContext(worker, {
    URL,
    Set,
    self: {
      registration: { scope: "https://example.test/fixmycity/" },
      addEventListener() {},
    },
    Request: class {
      constructor(url: string) {
        files.push(url);
      }
    },
  });
  const list = worker.match(/const SHELL = (\[[\s\S]*?\])\.map/);
  assert.ok(list, "A precache list must be present");
  const entries = vm.runInNewContext(list[1]) as string[];
  assert.ok(entries.includes("intro.js"));
  for (const file of entries)
    assert.ok(Object.hasOwn(pages,file) || (await stat(new URL(file, bundle))).isFile(), file);
});

test("no static HTML files remain in source or build output", async () => {
  async function check(directory: URL): Promise<void> {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const location = new URL(entry.name+(entry.isDirectory()?"/":""),directory);
      if (entry.isDirectory()) await check(location);
      else assert.ok(!/\.html?$/i.test(entry.name), location.pathname);
    }
  }
  await check(new URL("../", import.meta.url));
});
