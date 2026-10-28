import { pages } from "./pages.js";
import assert from "node:assert/strict";
import test from "node:test";
import worker from "./worker.ts";

test("the bare path redirects to the directory URL and preserves the query", async () => {
  const response = await worker.fetch(
    new Request("https://lownamlee.com/fixmycity?view=map"),
    {
      ASSETS: {
        fetch() {
          throw new Error("Unexpected asset lookup");
        },
      },
    },
  );
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://lownamlee.com/fixmycity/?view=map",
  );
});

test("TypeScript pages render directly while nested assets use the static bundle", async () => {
  for (const [requestPath, assetPath] of [
    ["/fixmycity/", "/index.html"],
    ["/fixmycity/intro.html", "/intro.html"],
    ["/fixmycity/assets/issues/pothole.webp", "/assets/issues/pothole.webp"],
  ]) {
    let actual: string | undefined;
    const response = await worker.fetch(
      new Request("https://lownamlee.com" + requestPath),
      {
        ASSETS: {
          fetch(request) {
            actual = new URL(request.url).pathname;
            return new Response("asset");
          },
        },
      },
    );
    const pageName=assetPath.slice(1);
    assert.equal(actual, Object.hasOwn(pages,pageName)?undefined:assetPath);
    if(Object.hasOwn(pages,pageName)) {
      assert.equal(await response.text(),pages[pageName]);
      assert.match(response.headers.get("Content-Type") || "",/text\/html/);
    }
    assert.equal(response.status, 200);
  }
});

test("HEAD and query parameters survive the prefix rewrite", async () => {
  await worker.fetch(
    new Request("https://lownamlee.com/fixmycity/assets/logo.svg?v=2", {
      method: "HEAD",
    }),
    {
      ASSETS: {
        fetch(request) {
          assert.equal(request.method, "HEAD");
          assert.equal(new URL(request.url).search, "?v=2");
          return new Response(null);
        },
      },
    },
  );
});

test("unrelated and lookalike paths never reach the asset binding", async () => {
  for (const requestPath of [
    "/",
    "/merdeka/",
    "/fixmycity-extra/",
    "/fixmycity2/",
  ]) {
    const response = await worker.fetch(
      new Request("https://lownamlee.com" + requestPath),
      {
        ASSETS: {
          fetch() {
            throw new Error("Unexpected asset lookup");
          },
        },
      },
    );
    assert.equal(response.status, 404);
  }
});

test("the UI host rejects non-read HTTP methods", async () => {
  const response = await worker.fetch(
    new Request("https://lownamlee.com/fixmycity/", { method: "POST" }),
    {
      ASSETS: {
        fetch() {
          throw new Error("Unexpected asset lookup");
        },
      },
    },
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

test("HEAD page responses contain headers and no body", async () => {
  for (const path of ["/fixmycity/", "/fixmycity/index.html", "/fixmycity/intro.html"]) {
    const response = await worker.fetch(new Request("https://lownamlee.com"+path, {method:"HEAD"}), {
      ASSETS: {fetch(){throw new Error("Page must not read a static file");}},
    });
    assert.equal(response.status,200);
    assert.equal(await response.text(),"");
    assert.match(response.headers.get("Content-Type") || "",/text\/html/);
    assert.ok(Number(response.headers.get("Content-Length"))>0);
  }
});
