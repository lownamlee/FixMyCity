/** Renders the scan-face interface without a static HTML file. */
export function renderScanFace(): string {
  return `<!doctype html>

<html lang="en">

<head>

  <meta charset="utf-8">

  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

  <meta name="theme-color" content="#eef1f6">

  <title>Scan Face — Interactive Preview</title>

<!-- Embedded Roboto font from Google Fonts. Licensed under the SIL Open Font License 1.1.

Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic)



This Font Software is licensed under the SIL Open Font License, Version 1.1.

This license is copied below, and is also available with a FAQ at:

https://openfontlicense.org





-----------------------------------------------------------

SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

-----------------------------------------------------------



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

or substituting -- in part or in whole -- any of the components of the

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

  <link rel="stylesheet" href="scan-face.css">

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

<link rel="stylesheet" href="face-actions.css">

<link rel="stylesheet" href="app-language.css">
<script src="app-language.js" defer></script>
</head>

<body class="page-face camera-blocked" data-camera-facing="user" data-layout="flow">

  <!-- Illustrations use clipped reference assets. Face landmarks are processed on this device. Only action measurements are sent to the session API. -->

  <svg class="asset-definitions" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">

    <defs>

      <image id="reference-art" width="1536" height="1024" href="assets/media/0863702fdd76ccfb6fbb.png"/>

      <symbol id="status-icons" viewBox="0 0 76 18">

        <g fill="currentColor"><rect x="0" y="11" width="3.5" height="5" rx="1"/><rect x="5" y="8" width="3.5" height="8" rx="1"/><rect x="10" y="5" width="3.5" height="11" rx="1"/><rect x="15" y="2" width="3.5" height="14" rx="1"/></g>

        <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M25 6q7-7 14 0M28 9q4-4 8 0M31 12q1-1 2 0"/></g><circle cx="32" cy="14" r="1.2" fill="currentColor"/>

        <rect x="46" y="3" width="25" height="12" rx="3" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="48" y="5" width="21" height="8" rx="1.6" fill="currentColor"/><path d="M73 6v6q3-1 0-6" fill="currentColor" opacity=".6"/>

      </symbol>

      <symbol id="lock" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/><circle cx="12" cy="15" r=".8"/></symbol>

      <symbol id="shield" viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 4.1 8.6 8 11 3.9-2.4 8-6 8-11V5l-8-3Z"/><path d="m8.5 11.5 2.5 2.5 4.5-4.5"/></symbol>

      <symbol id="user" viewBox="0 0 24 24"><circle cx="12" cy="6.5" r="4.2"/><path d="M3.5 22v-2a8.5 6.5 0 0 1 17 0v2Z"/></symbol>

    </defs>

  </svg>

  <section class="camera-permission" id="camera-permission" aria-labelledby="camera-permission-title">

<button type="button" class="camera-permission-back" id="camera-permission-back" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 19-7-7 7-7M5 12h14"/></svg></button>

<!-- Camera geometry and snap motion adapted from useAnimations (MIT); see assets/icons/useanimations-LICENSE.txt. -->

<div class="camera-permission-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path class="camera-icon-body" d="M27 23c0 1.105-.895 2-2 2H7c-1.105 0-2-.895-2-2V12c0-1.105.895-2 2-2h4l2-3h6l2 3h4c1.105 0 2 .895 2 2z"/><path class="camera-icon-lens" d="M16 13c2.209 0 4 1.791 4 4s-1.791 4-4 4-4-1.791-4-4 1.791-4 4-4z"/></svg></div>

<h1 id="camera-permission-title" tabindex="-1">Enable your camera</h1>

<p id="camera-permission-message">Camera access is required before you can continue.</p>

<div class="camera-settings-help" id="camera-settings-help" hidden><strong>Enable Camera in browser settings</strong><ol><li>Open the site controls beside the address bar, or your browser’s website settings.</li><li>Find Camera and choose Allow for fixmycity.online. If needed, also allow camera access in your device settings.</li><li>Return to this page and tap Try again.</li></ol></div>

<div class="camera-permission-action"><button type="button" id="camera-enable" class="fmc-button">Enable camera</button><small>Your photos will be checked as agreed in the MyKad consent step.</small></div>

</section>

<main class="stage camera-app-content" aria-label="Automatic face movement check">

    <section class="device-slot" id="scan-screen" data-active="true" aria-label="Face scan in progress">

      <div class="phone"><div class="screen">

        <div class="notch" aria-hidden="true"></div>

        <header class="scan-header">

          <div class="status-bar" aria-hidden="true"><span>9:41</span><svg class="status-icons"><use href="#status-icons"/></svg></div>

          <div class="scan-nav"><button type="button" class="close-button" id="cancel-scan" aria-label="Cancel scan"><svg viewBox="0 0 24 24"><path d="m5 5 14 14M19 5 5 19"/></svg></button><h1>Scan Face</h1></div>

        </header>

        <div class="scan-instructions"><span id="face-step-count" class="face-step-count">1 of 3</span><h2 id="scan-instruction">Finding your face</h2><p>Keep your face within the frame</p></div>

        <div class="face-circle" role="progressbar" aria-label="Face movement progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">

          <div class="portrait"><video class="live-face-video" data-camera-video autoplay muted playsinline aria-label="Live camera preview"></video><canvas id="face-landmarks" aria-hidden="true"></canvas></div>

          <svg class="ring" viewBox="0 0 350 350" aria-hidden="true">

            <defs><filter id="tip-glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="5"/></filter></defs>

            <circle class="ring-track" cx="175" cy="175" r="168"/>

            <circle class="ring-progress" id="ring-progress" cx="175" cy="175" r="168"/>

            <g class="ring-tip" id="ring-tip"><circle cx="175" cy="7" r="15" fill="#347eff" opacity=".8" filter="url(#tip-glow)"/><circle cx="175" cy="7" r="10" fill="#fff" stroke="#86b3ff" stroke-width="2"/></g>

          </svg>

        </div>

        <div class="scan-caption"><div class="face-actions" aria-label="Required movements"><span id="face-action-0" class="face-action">Turn left</span><span id="face-action-1" class="face-action">Turn right</span><span id="face-action-2" class="face-action">Blink once</span></div><h2 id="scan-caption">Preparing face detection…</h2><p id="face-capture-help">Left, right, then blink — no tapping needed</p><small class="face-preview-label">Automatic scan · follow the prompts</small><a class="face-privacy" href="privacy?from=scan-face">Privacy policy</a></div>

        <div class="home-indicator" aria-hidden="true"></div>

      </div></div>

    </section>

    <section class="device-slot" id="success-screen" data-active="false" aria-label="Verification complete">

      <div class="phone"><div class="screen">

        <div class="notch" aria-hidden="true"></div>

        <div class="status-bar" aria-hidden="true"><span>9:41</span><svg class="status-icons"><use href="#status-icons"/></svg></div>

        <div class="success-content">

          <svg class="art" viewBox="1153 225 225 213" role="img" aria-label="Illustration of a verified face on a phone with a green check"><use href="#reference-art"/></svg>

          <h1>All done</h1><h2>Verification complete</h2>

          <p class="description">You’re ready to explore FixMyCity.<br>Opening your home page…</p>

          <dl class="device-details">

            <div class="detail-row"><dt>Scan mode</dt><dd>Live camera</dd></div>

            <div class="detail-row"><dt>Face check</dt><dd>Passed</dd></div>

            <div class="detail-row"><dt>Status</dt><dd class="active-status"><span class="active-dot" aria-hidden="true"></span>Completed</dd></div>

          </dl>

        </div>

        <div class="screen-footer"><button type="button" class="primary-button fmc-button" id="continue-button">Continue</button></div>

        <div class="home-indicator" aria-hidden="true"></div>

      </div></div>

    </section>

  </main>

  

  <p class="sr-only" id="announcement" role="status" aria-live="polite"></p>

  <dialog id="face-result" aria-labelledby="face-result-title"><h2 id="face-result-title">Face check</h2><p id="face-result-message"></p><button type="button" id="face-result-action" class="primary-button fmc-button">Try again</button></dialog>

<section id="face-checking" class="verification-checking" role="status" aria-live="polite" hidden><div class="verification-spinner" aria-hidden="true"></div><h2>Finishing your check</h2><p>Saving your verification result…</p><small>Please keep this page open.</small><button type="button" id="cancel-face-check">Cancel check</button></section>



<script src="verification-api.js" defer></script>

<script src="camera-permission-frame.js" defer></script>
<script src="phone-casing.js" defer></script>
<script src="camera-permission.js" defer></script>

<script src="verification-face.js" defer></script>

</body>

</html>

`;
}
