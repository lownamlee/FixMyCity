import { pages } from "./pages.js";

export function pageResponse(pathname: string, method: string): Response | undefined {
  const pageName = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!Object.hasOwn(pages, pageName)) return undefined;
  const document = pages[pageName];
  return new Response(method === "HEAD" ? null : document, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": String(new TextEncoder().encode(document).byteLength),
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
