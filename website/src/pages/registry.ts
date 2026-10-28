import { renderIndex } from "./index.js";
import { renderIntro } from "./intro.js";

export const pageRenderers = {
  "index.html": renderIndex,
  "intro.html": renderIntro,
} satisfies Record<string, () => string>;

export type PageName = keyof typeof pageRenderers;
export type PageDocuments = { readonly [Name in PageName]: string };

export function renderPages(): PageDocuments {
  return {
    "index.html": renderIndex(),
    "intro.html": renderIntro(),
  };
}
