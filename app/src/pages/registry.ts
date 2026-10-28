import { renderIndex } from "./index.js";
import { renderWelcome } from "./welcome.js";
import { renderScanCard } from "./scan-card.js";
import { renderScanFace } from "./scan-face.js";
import { renderHome } from "./home.js";
import { renderPrivacy } from "./privacy.js";
import { renderAiLab } from "./ai-lab.js";
import { renderCases } from "./cases.js";
import { renderAuthority } from "./authority.js";

export const pageRenderers = {
  "index.html": renderIndex,
  "welcome.html": renderWelcome,
  "scan-card.html": renderScanCard,
  "scan-face.html": renderScanFace,
  "home.html": renderHome,
  "privacy.html": renderPrivacy,
  "ai-lab.html": renderAiLab,
  "cases.html": renderCases,
  "authority.html": renderAuthority,
} satisfies Record<string, () => string>;

export type PageName = keyof typeof pageRenderers;
export type PageDocuments = { readonly [Name in PageName]: string };

export function renderPages(): PageDocuments {
  return {
    "index.html": renderIndex(),
    "welcome.html": renderWelcome(),
    "scan-card.html": renderScanCard(),
    "scan-face.html": renderScanFace(),
    "home.html": renderHome(),
    "privacy.html": renderPrivacy(),
    "ai-lab.html": renderAiLab(),
    "cases.html": renderCases(),
    "authority.html": renderAuthority(),
  };
}
