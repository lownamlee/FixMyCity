import { handleIdentityRequest } from "./identity-api.js";
import { handleVoiceRequest } from "./voice-api.js";
import {handleReportAI} from './report-ai.js';
import {handleReportData} from './report-data.js';
import {pages} from './pages.js';
export {ReportAI} from './report-ai.js';
export { IdentitySession, VerificationBudget } from "./identity-api.js";
export { VoiceGateway } from "./voice-api.js";

const ALLOWED_HOSTS = new Set(["fixmycity.online", "127.0.0.1", "localhost", "[::1]"]);
const PAGES = new Map([["/", "/index.html"], ["/welcome", "/welcome.html"], ["/scan-card", "/scan-card.html"], ["/scan-face", "/scan-face.html"], ["/home", "/home.html"], ["/privacy", "/privacy.html"], ["/ai-lab", "/ai-lab.html"], ["/cases", "/cases.html"], ["/admin", "/authority.html"]]);
const TYPES = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  woff2: "font/woff2",
  wasm: "application/wasm",
  task: "application/octet-stream",
  tflite: "application/octet-stream",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try{url.pathname=decodeURIComponent(url.pathname);}catch{return new Response('Invalid path',{status:400});}
    if (!ALLOWED_HOSTS.has(url.hostname)) {
      return new Response("Not found", { status: 404 });
    }
    if (url.hostname === "fixmycity.online" && url.protocol !== "https:") {
      url.protocol = "https:";
      return Response.redirect(url, 308);
    }
    if(url.hostname==='fixmycity.online'&&/^\/(?:admin(?:\/|$)|authority(?:[./]|$)|api\/local-admin(?:\/|$))/.test(url.pathname))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
    if(/^\/api\/(?:reports|local-reports)(?:\/|$)/.test(url.pathname))return handleReportData(request,env);
    if(url.pathname==="/authority"||url.pathname==="/authority/"){url.pathname="/admin";return Response.redirect(url,308);}
    if (url.pathname.startsWith("/api/voice/")) return handleVoiceRequest(request, env);
    if (url.pathname.startsWith("/api/ai/")) return handleReportAI(request, env);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return handleIdentityRequest(request, env);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    for (const [clean, file] of PAGES) {
      if (url.pathname === file || (clean !== "/" && url.pathname === clean + "/")) {
        url.pathname = clean;
        return Response.redirect(url, 308);
      }
    }
    url.pathname = PAGES.get(url.pathname) || url.pathname;
    const pageName = url.pathname.slice(1);
    const original = Object.hasOwn(pages, pageName)
      ? new Response(request.method === "HEAD" ? null : pages[pageName])
      : await env.ASSETS.fetch(new Request(url, request));
    const response = new Response(request.method === "HEAD" ? null : original.body, original);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
    const extension = url.pathname.split(".").pop();
    if (response.ok && TYPES[extension]) response.headers.set("Content-Type", TYPES[extension]);
    if (/\.(?:html|js|css|webmanifest|json)$/.test(url.pathname)) {
      response.headers.set("Cache-Control", "no-cache");
    } else if (response.ok && url.pathname.startsWith("/assets/")) {
      const versionedArtwork = /^\/assets\/onboarding\/[a-z-]+-[a-f0-9]{16}\.webp$/.test(url.pathname);
      response.headers.set("Cache-Control", versionedArtwork ? "public, max-age=31536000, immutable" : "public, max-age=3600");
    }
    if (url.pathname === "/service-worker.js") {
      response.headers.set("Service-Worker-Allowed", "/");
      response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    }
    return response;
  },
};
