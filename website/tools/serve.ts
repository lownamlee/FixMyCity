import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pageResponse } from "../deploy/page-response.js";

const root = fileURLToPath(new URL("../deploy/dist/", import.meta.url));
const port = Number(process.env.PORT || 4440);
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const url = new URL(request.url || "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/fixmycity") {
      response.writeHead(308, { Location: "/fixmycity/" + url.search }).end();
      return;
    }
    if (pathname.startsWith("/fixmycity/"))
      pathname = pathname.slice("/fixmycity".length);
    const page = pageResponse(pathname, request.method || "GET");
    if (page) {
      response.writeHead(page.status, Object.fromEntries(page.headers));
      response.end(request.method === "HEAD" ? undefined : await page.text());
      return;
    }
    const file = path.resolve(
      root,
      "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
    );
    if (!file.startsWith(root) || !(await stat(file)).isFile()) {
      response.writeHead(404).end();
      return;
    }
    const contents = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Content-Length": contents.length,
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`FixMyCity: http://127.0.0.1:${port}/fixmycity/`),
);
