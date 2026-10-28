import { renderPages } from "../src/pages/registry.js";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const deployDirectory = await realpath(
  path.dirname(fileURLToPath(import.meta.url)),
);
const appDirectory = path.resolve(deployDirectory, "..");
const outputDirectory = path.resolve(deployDirectory, "dist");
const expectedOutput = path.join(deployDirectory, "dist");
if (
  outputDirectory !== expectedOutput ||
  path.dirname(outputDirectory) !== deployDirectory
) {
  throw new Error("The deployment output must remain inside deploy/dist.");
}

const entryNames = new Set([
  "styles.css",
  "city-map.css",
  "photo-picker.css",
  "favicon.svg",
  "favicon.ico",
  "manifest.webmanifest",
]);
const assetExtensions = new Set([
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".css",
  ".js",
  ".mjs",
  ".txt",
]);

const browserScripts = [
  "app.js",
  "city-map.js",
  "photo-picker.js",
  "story-gestures.js",
  "pwa.js",
  "intro.js",
];
const files: string[] = [...browserScripts, "service-worker.js"];
for (const entry of await readdir(appDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entryNames.has(entry.name)) files.push(entry.name);
}

async function collectAssets(directory: string, relativeDirectory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const relative = path.join(relativeDirectory, entry.name);
    const source = path.join(appDirectory, relative);
    if (entry.isSymbolicLink())
      throw new Error(`Symlinks are not packaged: ${relative}`);
    if (entry.isDirectory()) {
      await collectAssets(source, relative);
    } else if (
      entry.isFile() &&
      assetExtensions.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(relative);
    }
  }
}

const assetsDirectory = path.join(appDirectory, "assets");
try {
  const stat = await lstat(assetsDirectory);
  if (stat.isSymbolicLink())
    throw new Error("The assets directory must not be a symlink.");
  if (stat.isDirectory()) await collectAssets(assetsDirectory, "assets");
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw error;
}

// Only this script's exact, verified staging directory can be replaced.
try {
  const existing = await lstat(outputDirectory);
  if (existing.isSymbolicLink())
    throw new Error("Refusing to replace a symlink at deploy/dist.");
  const resolved = await realpath(outputDirectory);
  if (resolved !== expectedOutput)
    throw new Error("Unexpected deployment output path.");
  await rm(outputDirectory, { recursive: true, force: true });
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw error;
}
await mkdir(outputDirectory, { recursive: true });

const manifest = [];
for (const relative of files.sort()) {
  const source =
    relative === "service-worker.js"
      ? path.join(appDirectory, ".build/worker", relative)
      : browserScripts.includes(relative)
        ? path.join(appDirectory, ".build/browser", relative)
        : path.join(appDirectory, relative);
  const destination = path.join(outputDirectory, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  const contents = await readFile(destination);
  manifest.push({
    file: relative.replaceAll(path.sep, "/"),
    bytes: contents.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}
const documents = renderPages();
const prepaint = await readFile(path.join(appDirectory, ".build/browser/intro-prepaint.js"), "utf8");
if (!documents["index.html"].includes("<!-- INTRO_PREPAINT -->"))
  throw new Error("Missing intro prepaint placeholder.");
const pages = {
  ...documents,
  "index.html": documents["index.html"].replace("<!-- INTRO_PREPAINT -->", `<script id="intro-prepaint">${prepaint}</script>`),
};
await writeFile(
  path.join(deployDirectory, "pages.js"),
  `// Generated from src/pages/*.ts.\nexport const pages = Object.freeze(${JSON.stringify(pages)});\n`,
);
const pageManifest = Object.entries(pages).map(([route, document]) => ({
  route,
  bytes: Buffer.byteLength(document),
  sha256: createHash("sha256").update(document).digest("hex"),
}));
await writeFile(
  path.join(deployDirectory, "package-manifest.json"),
  JSON.stringify(
    {
      source: appDirectory,
      output: outputDirectory,
      files: manifest,
      pages: pageManifest,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${manifest.length} files (${manifest.reduce((total, file) => total + file.bytes, 0)} bytes) in ${outputDirectory}`,
);
