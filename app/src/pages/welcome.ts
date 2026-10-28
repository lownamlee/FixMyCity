/** Renders the welcome interface without a static HTML file. */
export function renderWelcome(): string {
  return `<!doctype html>
<html lang="en" data-flow-page="welcome">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#032650">
  <meta name="description" content="Welcome to FixMyCity. Report with AI, follow progress, and earn recognition for verified contributions.">
  <link rel="preload" as="image" type="image/webp" href="assets/onboarding/city-9a19d4d60f8e5c82.webp" fetchpriority="high">
  <title>Welcome · FixMyCity</title>
  <link rel="stylesheet" href="welcome.css">
  <link rel="stylesheet" href="welcome-scenes.css">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="FixMyCity">
  <meta name="mobile-web-app-capable" content="yes">
  <script src="app-flow.js"></script>
  <script src="pwa.js"></script>
<link rel="stylesheet" href="app.css">
<script src="press-feedback.js" defer></script>
<link rel="stylesheet" href="app-language.css">
<script src="app-language.js" defer></script>
</head>
<body>
  <main class="stage" aria-label="Welcome to FixMyCity"></main>
  <template id="onboarding">
    <article class="device" aria-roledescription="carousel" aria-label="FixMyCity introduction">
      <div class="viewport"><div class="canvas">
        <div class="notch" aria-hidden="true"></div>
        <div class="status" aria-hidden="true">
          <span class="status-time">9:41</span>
          <span class="status-icons">
            <svg width="19" height="14" viewBox="0 0 19 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx=".7"/><rect x="5" y="6" width="3" height="8" rx=".7"/><rect x="10" y="3" width="3" height="11" rx=".7"/><rect x="15" y="0" width="3" height="14" rx=".7"/></svg>
            <svg width="19" height="14" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 4.4a12.5 12.5 0 0 1 16 0M5 7.5a8 8 0 0 1 10 0M8 10.5a3.2 3.2 0 0 1 4 0"/><circle cx="10" cy="13" r=".7" fill="currentColor" stroke="none"/></svg>
            <svg width="26" height="13" viewBox="0 0 29 14" fill="none"><rect x=".7" y=".7" width="24" height="12.6" rx="3" stroke="currentColor" opacity=".65"/><rect x="2.5" y="2.5" width="20.5" height="9" rx="1.5" fill="currentColor"/><path d="M26.3 4.5v5a2.5 2.5 0 0 0 0-5" fill="currentColor" opacity=".6"/></svg>
          </span>
        </div>
        <button class="skip" type="button" aria-label="Skip verification and go to Home">Skip</button>
        <div class="pages">
          <section class="page" role="group" aria-roledescription="slide" aria-label="1 of 3">
            <img class="brand" src="assets/media/ac16c9ed522901498c47.svg" alt="FixMyCity" width="277" height="149" draggable="false">
            <div class="copy"><h1>A Cleaner, Safer<br>City Starts With You</h1><p>Report issues in your city, track progress,<br>and help make your community better.</p></div>
            <div class="scene scene-city" role="img" aria-label="An illustrated Kuala Lumpur skyline, blue trees and a curving road">
              <svg class="city-art" viewBox="16 25 1503 999" aria-hidden="true" focusable="false"><image width="1536" height="1024" href="assets/onboarding/city-9a19d4d60f8e5c82.webp"/></svg>
              <span class="city-spark spark-one" aria-hidden="true"></span><span class="city-spark spark-two" aria-hidden="true"></span><span class="city-spark spark-three" aria-hidden="true"></span>
            </div>
          </section>
          <section class="page" role="group" aria-roledescription="slide" aria-label="2 of 3" inert aria-hidden="true">
            <img class="brand" src="assets/media/ac16c9ed522901498c47.svg" alt="FixMyCity" width="277" height="149" draggable="false">
            <div class="copy"><h1>Report with AI</h1><p>Take a photo, speak, or type. AI helps organise the details and find the right authorities.</p></div>
            <div class="scene scene-report" role="group" aria-label="A road-damage report with photo, voice and location, connected to the authorities">
              <svg class="report-backdrop" viewBox="41 57 1301 1054" aria-hidden="true" focusable="false">
                <defs>
                  <path id="report-phone-shape" d="M309 225 L659 188 Q703 184 710 240 L758 843 Q766 896 707 907 L362 931 Q319 934 312 880 L252 280 Q247 235 309 225Z"/>
                  <path id="report-photo-shape" d="M342 269 L623 246 Q650 244 656 271 L674 426 Q677 455 649 459 L358 483 Q330 487 328 458 L313 301 Q309 276 342 269Z"/>
                  <clipPath id="report-phone-clip"><use href="#report-phone-shape"/></clipPath>
                  <clipPath id="report-photo-clip"><use href="#report-photo-shape"/></clipPath>
                  <mask id="report-backdrop-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1374" height="1145">
                    <rect width="1374" height="1145" fill="white"/><use href="#report-phone-shape" fill="black" stroke="black" stroke-width="7"/>
                    <path d="M706 222H1005V408H706Z" fill="black"/>
                    <rect x="784" y="741" width="351" height="111" rx="52" fill="black"/><circle cx="1119" cy="767" r="75" fill="black"/>
                  </mask>
                </defs>
                <image width="1374" height="1145" data-asset="assets/onboarding/report-f5949dcdfa752fad.webp" mask="url(#report-backdrop-mask)"/>
                <path class="report-route" d="M731 280 Q901 182 956 385" fill="none" stroke="#087fff" stroke-width="13" stroke-dasharray="27 24" stroke-linecap="round"/>
                <path class="report-arrowhead" d="M925 366 L958 397 L972 354" fill="none" stroke="#087fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div class="report-phone-layer">
                <svg viewBox="41 57 1301 1054" aria-hidden="true" focusable="false">
                  <g clip-path="url(#report-phone-clip)">
                    <image width="1374" height="1145" data-asset="assets/onboarding/report-f5949dcdfa752fad.webp"/>
                    <use href="#report-photo-shape" fill="#c8e5ff"/>
                    <image class="report-photo" width="1374" height="1145" data-asset="assets/onboarding/report-f5949dcdfa752fad.webp" clip-path="url(#report-photo-clip)"/>
                    <path d="M326 492 L674 465 L680 547 L331 577Z" fill="#e5f3fc"/>
                    <path d="M347 694 L692 664 L701 768 L356 799Z" fill="#d4ebfc"/>
                  </g>
                </svg>
                <span class="welcome-report-title">Road damage</span>
                <span class="report-wave" aria-hidden="true">
                  <i style="--h:24%;--i:0"></i><i style="--h:46%;--i:1"></i><i style="--h:64%;--i:2"></i><i style="--h:34%;--i:3"></i><i style="--h:80%;--i:4"></i><i style="--h:100%;--i:5"></i><i style="--h:76%;--i:6"></i><i style="--h:49%;--i:7"></i><i style="--h:65%;--i:8"></i><i style="--h:32%;--i:9"></i><i style="--h:46%;--i:10"></i><i style="--h:88%;--i:11"></i><i style="--h:69%;--i:12"></i><i style="--h:39%;--i:13"></i><i style="--h:56%;--i:14"></i><i style="--h:80%;--i:15"></i><i style="--h:44%;--i:16"></i><i style="--h:62%;--i:17"></i><i style="--h:94%;--i:18"></i><i style="--h:72%;--i:19"></i><i style="--h:46%;--i:20"></i><i style="--h:26%;--i:21"></i>
                </span>
              </div>
              <span class="authority-label">Authorities</span>
              <span class="authority-check scene-check" aria-hidden="true"><svg viewBox="0 0 36 36"><path d="m10 18 6 6 11-12"/></svg></span>
            </div>
          </section>
          <section class="page" role="group" aria-roledescription="slide" aria-label="3 of 3" inert aria-hidden="true">
            <img class="brand" src="assets/media/ac16c9ed522901498c47.svg" alt="FixMyCity" width="277" height="149" draggable="false">
            <div class="copy"><h1>Track Progress.<br>Earn Recognition.</h1><p>Follow your report, check the repair, and<br>earn recognition for verified contributions.</p></div>
            <div class="scene scene-progress" role="group" aria-label="Report progress">
              <svg class="progress-backdrop" viewBox="30 88 1485 864" aria-hidden="true" focusable="false">
                <defs>
                  <filter id="progress-edge-feather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
                  <mask id="progress-clean-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024"><rect x="320" y="170" width="940" height="640" rx="62" fill="white" filter="url(#progress-edge-feather)"/></mask>
                  <mask id="progress-original-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024"><rect width="1536" height="1024" fill="white"/><rect x="320" y="170" width="940" height="640" rx="62" fill="black" filter="url(#progress-edge-feather)"/></mask>
                </defs>
                <image width="1536" height="1024" data-asset="assets/onboarding/progress-c21e57c08396b16a.webp" mask="url(#progress-original-mask)"/>
                <image width="1536" height="1024" data-asset="assets/onboarding/progress-plate-663687f99fa8dc6b.webp" mask="url(#progress-clean-mask)"/>
              </svg>
              <ol class="progress-steps">
                <li class="progress-step step-reported"><span class="scene-check" aria-hidden="true"><svg viewBox="0 0 36 36"><path pathLength="1" d="m10 18 6 6 11-12"/></svg></span><span class="step-label">Reported</span></li>
                <li class="progress-step step-assigned"><span class="scene-check" aria-hidden="true"><svg viewBox="0 0 36 36"><path pathLength="1" d="m10 18 6 6 11-12"/></svg></span><span class="step-label">Assigned</span></li>
                <li class="progress-step step-repaired"><span class="scene-check" aria-hidden="true"><svg viewBox="0 0 36 36"><path pathLength="1" d="m10 18 6 6 11-12"/></svg></span><span class="step-label">Repaired</span></li>
                <li class="progress-step step-verified"><span class="scene-check" aria-hidden="true"><svg viewBox="0 0 36 36"><path pathLength="1" d="m10 18 6 6 11-12"/></svg></span><span class="step-label">Verified</span></li>
              </ol>
              <div class="repaired-picture" aria-hidden="true"><img data-asset="assets/onboarding/repaired-road-c151422d1073871b.webp" alt="" width="1254" height="1254" draggable="false"></div>
              <div class="recognition-reveal" aria-hidden="true">
                <div class="recognition-float">
                  <svg class="recognition-art" viewBox="240 160 775 975" focusable="false"><image width="1254" height="1254" data-asset="assets/onboarding/recognition-medal-410f1025f46f1ea0.webp"/></svg>
                  <svg class="medal-rays" viewBox="0 0 150 150" fill="none" stroke="#ffd528" stroke-width="4" stroke-linecap="round"><path d="m16 52-10-4m10 23L5 73m16 18-9 7m120-48 10-9m-8 29 11-1m-12 24 10 6"/></svg>
                  <span class="medal-check scene-check"><svg viewBox="0 0 36 36"><path d="m10 18 6 6 11-12"/></svg></span>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div class="footer-shade"></div>
        <nav class="footer" aria-label="Introduction navigation">
          <button class="primary fmc-button next" type="button">Next</button>
          <a class="primary fmc-button start" href="scan-card" hidden>Get Started</a>
          <div class="dots" role="group" aria-label="Choose a welcome page">
            <button class="dot" type="button" aria-label="Page 1: A cleaner, safer city" aria-current="step"></button>
            <button class="dot" type="button" aria-label="Page 2: Report with AI"></button>
            <button class="dot" type="button" aria-label="Page 3: Track progress and earn recognition"></button>
          </div>
        </nav>
        <span class="announcement sr-only" aria-live="polite" aria-atomic="true"></span>
      </div></div>
    </article>
  </template>
  <script src="welcome.js"></script>
</body>
</html>

`;
}
