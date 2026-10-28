/** Renders the scan-card interface without a static HTML file. */
export function renderScanCard(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#c5c6c8">
  <meta name="description" content="Guided physical MyKad capture and AI authenticity screening for FixMyCity.">
  <title>Scan Card</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='11' fill='%233b86ff'/%3E%3Cpath d='M11 17v-6h6m6 0h6v6m0 6v6h-6m-6 0h-6v-6M10 20h20' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="scan-card.css">
<link rel="stylesheet" href="verification.css">
<link rel="stylesheet" href="camera-permission.css">
<link rel="stylesheet" href="phone-casing.css">
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
<body class="page-card camera-blocked" data-camera-facing="environment">
  <svg class="svg-assets" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <image id="reference-photo" width="3200" height="2400" href="assets/media/8ec39ca428913d9ee13e.png"/>
      <!-- Adjacent photo rows cover the reference's static scan lines so only
           the live CSS scan line is visible. The embedded image stays unchanged. -->
      <!-- Photo-guidance wording and the two illustrations are from the official
           MyDigital ID Registration Guide, screen 7 (PDF page 4):
           https://www.digital-id.my/pdf/UserJourneyPendaftaranOnlineNFizikalMYID.pdf
           Only the front/back illustration regions are displayed below.
           This standalone UI preview is not an official MyDigital ID application. -->
      <image id="mydigital-guidance-art" width="422" height="892" href="assets/media/1d7649ec1402edcbccbe.png"/>
      <g id="front-camera-photo">
        <use href="#reference-photo"/>
        <svg x="170" y="1189" width="830" height="12" viewBox="170 1177 830 12" preserveAspectRatio="none" overflow="hidden"><use href="#reference-photo"/></svg>
      </g>
      <g id="back-camera-photo">
        <use href="#reference-photo"/>
        <svg x="1190" y="1317" width="830" height="13" viewBox="1190 1304 830 13" preserveAspectRatio="none" overflow="hidden"><use href="#reference-photo"/></svg>
      </g>
      <symbol id="scan-icon" viewBox="0 0 28 28"><path d="M9 2H2v7m17-7h7v7M2 19v7h7m17-7v7h-7M2 14h24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
      <symbol id="close-icon" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
      <symbol id="check-icon" viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    </defs>
  </svg>

  <section class="camera-permission" id="camera-permission" aria-labelledby="camera-permission-title">
<button type="button" class="camera-permission-back" id="camera-permission-back" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 19-7-7 7-7M5 12h14"/></svg></button>
<!-- Camera geometry and snap motion adapted from useAnimations (MIT); see assets/icons/useanimations-LICENSE.txt. -->
<div class="camera-permission-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path class="camera-icon-body" d="M27 23c0 1.105-.895 2-2 2H7c-1.105 0-2-.895-2-2V12c0-1.105.895-2 2-2h4l2-3h6l2 3h4c1.105 0 2 .895 2 2z"/><path class="camera-icon-lens" d="M16 13c2.209 0 4 1.791 4 4s-1.791 4-4 4-4-1.791-4-4 1.791-4 4-4z"/></svg></div>
<h1 id="camera-permission-title" tabindex="-1">Enable your camera</h1>
<p id="camera-permission-message">Camera access is required before you can continue.</p>
<div class="camera-settings-help" id="camera-settings-help" hidden><strong>Enable Camera in browser settings</strong><ol><li>Open the site controls beside the address bar, or your browser’s website settings.</li><li>Find Camera and choose Allow for fixmycity.online. If needed, also allow camera access in your device settings.</li><li>Return to this page and tap Try again.</li></ol></div>
<div class="camera-permission-action"><button type="button" id="camera-enable" class="fmc-button">Enable camera</button></div>
</section>
<main class="phone camera-app-content" aria-label="MyKad photo guidance and verification scanner">
    <section class="guidance-page" id="guidance-page" aria-labelledby="guidance-title">
      <header class="guidance-banner"><button type="button" id="guide-back" class="guide-back" aria-label="Back to welcome"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 19-7-7 7-7M5 12h14"/></svg></button>
        <div class="status-bar" aria-hidden="true">
          <span>9:41</span>
          <span class="status-icons">
            <svg class="signal" viewBox="0 0 22 16" fill="currentColor"><rect x="0" y="10" width="3.5" height="6" rx="1"/><rect x="6" y="7" width="3.5" height="9" rx="1"/><rect x="12" y="3.5" width="3.5" height="12.5" rx="1"/><rect x="18" y="0" width="3.5" height="16" rx="1"/></svg>
            <svg class="wifi" viewBox="0 0 24 20" fill="currentColor"><path d="M12 19 8.7 15.6a4.7 4.7 0 0 1 6.6 0ZM5.5 12.3l2.3 2.3a6 6 0 0 1 8.4 0l2.3-2.3a9.2 9.2 0 0 0-13 0ZM1.4 8.2l2.3 2.3a11.8 11.8 0 0 1 16.6 0l2.3-2.3a15 15 0 0 0-21.2 0Z"/></svg>
            <svg class="battery" viewBox="0 0 30 16"><rect x=".7" y="1" width="25.4" height="14" rx="3" fill="none" stroke="currentColor" stroke-opacity=".65" stroke-width="1.3"/><rect x="3" y="3.3" width="20.8" height="9.4" rx="1.3" fill="currentColor"/><path d="M28 5.4v5.2c2.1-.6 2.1-4.6 0-5.2" fill="currentColor" opacity=".65"/></svg>
          </span>
        </div>
        <svg class="guidance-motif" viewBox="0 0 170 88" fill="none" stroke-width="6" aria-hidden="true">
          <g transform="rotate(28 85 44)"><rect x="21" y="-39" width="26" height="98" rx="13" stroke="#15b8e3"/><rect x="28" y="-31" width="12" height="78" rx="6" stroke="#ee5069"/><rect x="69" y="-20" width="27" height="53" rx="13.5" stroke="#ffd552"/><circle cx="82.5" cy="17" r="4" stroke="white" stroke-width="3"/><rect x="117" y="-51" width="28" height="91" rx="14" stroke="#ef5a66"/><path d="M125-35v57a6 6 0 0 0 12 0V-35" stroke="white" stroke-width="5"/><circle cx="168" cy="-3" r="15" stroke="#16b8e5"/></g>
        </svg>
      </header>
      <div class="guidance-content" lang="ms">
        <h1 id="guidance-title" tabindex="-1">Tip e-KYC</h1>
        <p class="guide-prompt"><span class="guide-prompt-number">1.</span><span>Pegang MyKad secara menegak seperti di bawah:</span></p>
        <div class="guide-examples">
          <figure class="guide-example">
            <svg viewBox="40 175 166 195" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Hold the front of MyKad upright, facing the phone camera"><use href="#mydigital-guidance-art"/></svg>
            <figcaption>Hadapan</figcaption>
          </figure>
          <figure class="guide-example">
            <svg viewBox="223 175 166 195" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Hold the back of MyKad upright, facing the phone camera"><use href="#mydigital-guidance-art"/></svg>
            <figcaption>Belakang</figcaption>
          </figure>
        </div>
        <div class="guide-tips">
          <div class="guide-tip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.4"/><path d="M12 1.5v3m0 15v3M1.5 12h3m15 0h3M4.6 4.6l2.1 2.1m10.6 10.6 2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></svg>
            <p>Ambil gambar dalam keadaan terang</p>
          </div>
          <div class="guide-tip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" aria-hidden="true"><rect x="6" y="2.2" width="12" height="19.6" rx="2"/><path d="M10 5h4"/><circle cx="12" cy="18.5" r=".6" fill="currentColor" stroke="none"/></svg>
            <p>Pegang telefon dengan stabil</p>
          </div>
        </div>
      </div>
      <button class="privacy-choice" id="privacy-choices" type="button">Privacy choices</button>
      <button class="guide-continue" id="continue-button" type="button" lang="ms">Seterusnya</button>
    </section>

    <section class="scanner-page" id="scanner-page" aria-label="Scan Card" hidden>
    <div class="camera-scene" aria-hidden="true"><video class="live-card-video" data-camera-video autoplay muted playsinline></video>
      <div class="scene scene-front" id="front-scene">
        <svg class="scene-soft" viewBox="145 687 865 200" preserveAspectRatio="xMidYMid slice"><use href="#reference-photo"/></svg>
        <div class="scene-wash"></div>
        <svg class="scene-bottom" viewBox="145 1401 865 106" preserveAspectRatio="none"><use href="#reference-photo"/></svg>
        <svg class="scene-detail" viewBox="140 684 880 826" preserveAspectRatio="none"><use href="#front-camera-photo"/></svg>
      </div>
      <div class="scene scene-back" id="back-scene" hidden>
        <svg class="scene-soft" viewBox="1162 815 870 180" preserveAspectRatio="xMidYMid slice"><use href="#reference-photo"/></svg>
        <div class="scene-wash"></div>
        <svg class="scene-bottom" viewBox="1160 1530 880 112" preserveAspectRatio="none"><use href="#reference-photo"/></svg>
        <svg class="scene-detail" viewBox="1160 823 880 816" preserveAspectRatio="none"><use href="#back-camera-photo"/></svg>
      </div>
    </div>

    <header class="top-bar">
      <div class="status-bar" aria-hidden="true">
        <span>9:41</span>
        <span class="status-icons">
          <svg class="signal" viewBox="0 0 22 16" fill="currentColor"><rect x="0" y="10" width="3.5" height="6" rx="1"/><rect x="6" y="7" width="3.5" height="9" rx="1"/><rect x="12" y="3.5" width="3.5" height="12.5" rx="1"/><rect x="18" y="0" width="3.5" height="16" rx="1"/></svg>
          <svg class="wifi" viewBox="0 0 24 20" fill="currentColor"><path d="M12 19 8.7 15.6a4.7 4.7 0 0 1 6.6 0ZM5.5 12.3l2.3 2.3a6 6 0 0 1 8.4 0l2.3-2.3a9.2 9.2 0 0 0-13 0ZM1.4 8.2l2.3 2.3a11.8 11.8 0 0 1 16.6 0l2.3-2.3a15 15 0 0 0-21.2 0Z"/></svg>
          <svg class="battery" viewBox="0 0 30 16"><rect x=".7" y="1" width="25.4" height="14" rx="3" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.3"/><rect x="3" y="3.3" width="20.8" height="9.4" rx="1.3" fill="currentColor"/><path d="M28 5.4v5.2c2.1-.6 2.1-4.6 0-5.2" fill="currentColor" opacity=".55"/></svg>
        </span>
      </div>
      <div class="navigation">
        <button class="back-button" id="back-button" type="button" aria-label="Go back">
          <svg viewBox="0 0 16 24" aria-hidden="true"><path d="m11 3-7 9 7 9" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1>Scan MyKad</h1>
      </div>
    </header>

    <div class="instructions" aria-live="polite" aria-atomic="true">
      <div class="step-count" id="step-count">1/2</div>
      <p id="instruction">Hold the front of your physical MyKad inside the frame</p>
      <div id="card-capture-progress" class="card-capture-progress" role="img" aria-label="0 of 3 photos captured"><span id="card-dot-1"></span><span id="card-dot-2"></span><span id="card-dot-3"></span></div>
      <div class="scanner-status" id="scanner-status" role="status">Auto-check is on. Hold steady, or tap to capture.</div>
    </div>
    <div class="scan-frame" id="scan-frame" aria-hidden="true"><div class="scan-line"></div></div>
    <button class="capture-button" id="capture-button" type="button" aria-label="Capture front of card">
      <svg aria-hidden="true"><use href="#scan-icon"/></svg>
    </button>
    
    <button class="manual-button" id="verification-help" type="button">Photo tips</button>
    <div class="flash" id="flash" aria-hidden="true"></div>
    <div class="toast" id="toast" role="status" hidden></div>
    <span class="scanner-preview-label">Live camera · automatic MyKad checks</span>
    </section>
  </main>
  <p class="preview-note">Live camera · MyKad verification</p>

  

  
<dialog id="verification-consent" class="verification-consent" aria-labelledby="verification-consent-title">
<h2 id="verification-consent-title">Identity check</h2>
<p>Your MyKad scans automatically, then you complete a quick face check.</p>
<label class="verification-consent-choice"><input type="checkbox" id="verification-consent-check"><span>I agree to automatic camera captures and sending MyKad photos to FixMyCity for checking, and completing face verification.</span></label>
<a id="privacy-policy-link" class="privacy-policy-link" href="privacy?from=scan-card">Privacy policy <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></a>
<p id="consent-status" class="verification-status" role="status"></p>
<button class="primary" type="button" id="consent-continue" disabled>Agree and continue</button><button class="secondary" type="button" id="consent-cancel">Not now</button>
</dialog>
<dialog id="verification-result" aria-labelledby="verification-result-title"><h2 id="verification-result-title">MyKad check</h2><p id="verification-result-message"></p><button class="primary" type="button" id="verification-result-action">Try again</button></dialog>
<section id="verification-checking" class="verification-checking" role="status" aria-live="polite" hidden><div class="verification-spinner" aria-hidden="true"></div><h2>Checking your MyKad</h2><p id="verification-checking-message">Checking the physical card and photo quality…</p><small>Please keep this page open.</small><button type="button" id="cancel-verification-check">Cancel check</button></section>

<script src="verification-api.js" defer></script>
<script src="phone-casing.js" defer></script>
<script src="camera-permission-frame.js" defer></script>
<script src="camera-permission.js" defer></script>
<script src="verification-card.js" defer></script>
  <!-- Poppins font attribution and SIL Open Font License: Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


—————————————————————————————-
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
—————————————————————————————-

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting — in part or in whole — any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
 -->
</body>
</html>
`;
}
