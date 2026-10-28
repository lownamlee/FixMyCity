import { pageResponse } from "./page-response.js";

interface AssetEnvironment {
  ASSETS: { fetch(request: Request): Response | Promise<Response> };
}

const base = "/fixmycity";

export default {
  async fetch(request: Request, env: AssetEnvironment) {
    const url = new URL(request.url);
    if (url.pathname !== base && !url.pathname.startsWith(base + "/")) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }
    if (url.pathname === base) {
      url.pathname = base + "/";
      return Response.redirect(url.href, 308);
    }
    const relative = url.pathname.slice(base.length);
    const page = pageResponse(relative, request.method);
    if (page) return page;
    url.pathname = relative === "/" ? "/index.html" : relative;
    return env.ASSETS.fetch(new Request(url, request));
  },
};
