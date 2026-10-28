/** Renders the intro interface without a static HTML file. */
export function renderIntro(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#04285d">
  <meta name="color-scheme" content="dark">
  <meta name="description" content="FixMyCity app introduction.">
  <title>FixMyCity — Intro</title>
  <style>
    :root { color-scheme: dark; --blue:#2788fe; --navy:#04285d; --yellow:#ffd447; }
    * { box-sizing:border-box; }
    html, body { width:100%; min-width:0; max-width:100%; height:100%; margin:0; overflow:hidden; background:var(--blue); }
    body { font-family:Arial, Helvetica, sans-serif; }
    .scene { position:relative; width:100%; max-width:100%; height:100vh; height:100dvh; padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px); overflow:hidden; isolation:isolate; background:var(--blue); }
    .night { position:absolute; inset:0; background:radial-gradient(ellipse at 48% 45%,#0b3568 0%,#04285d 57%,#03214d 100%); clip-path:circle(0px at 50% 50%); will-change:clip-path; }
    .arrival { position:absolute; z-index:3; width:28px; height:28px; left:50%; top:50%; border-radius:50%; background:var(--yellow); opacity:0; will-change:transform,opacity; }
    .arrival-trail { position:absolute; z-index:2; width:42px; height:150px; left:50%; top:50%; overflow:visible; opacity:0; will-change:transform,opacity; }
    .lockup { position:absolute; z-index:4; top:50%; left:50%; width:min(88vw,900px,150vh); max-width:calc(100% - 32px); min-width:0; transform:translate(-50%,-50%); }
    .art { display:block; width:100%; max-width:100%; height:auto; overflow:visible; }
    .lockup.compact .art { overflow:hidden; }
    .skyline { fill:none; stroke:#fff; stroke-width:10.8; stroke-linejoin:round; stroke-linecap:round; stroke-dasharray:1; stroke-dashoffset:1; }
    .letter, .i-dot, #traveler, #tagline, .accent, .halo, .ripple { opacity:0; }
    .letter { will-change:transform,opacity; }
    .accent { fill:none; stroke:currentColor; stroke-width:2.3; stroke-linecap:round; stroke-linejoin:round; }
    #tagline { fill:#b9cee8; font-size:26px; font-weight:400; letter-spacing:2px; text-anchor:middle; }
    .closing-wipe { position:absolute; z-index:10; border-radius:50%; background:var(--blue); transform:translate(-50%,-50%) scale(0); pointer-events:none; will-change:transform; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    @media (max-width:600px) { #tagline { font-size:48px; letter-spacing:1.5px; } }
    @media (max-width:480px) { .arrival { width:19px; height:19px; } }
    @media (prefers-reduced-motion:reduce) { .arrival, .arrival-trail, .accent, .halo, .ripple, #traveler, .closing-wipe { display:none; } }
  </style>
  <noscript><style>.night{clip-path:none}.skyline{stroke-dashoffset:0}.letter,.i-dot,#tagline{opacity:1}</style></noscript>
</head>
<body>
  <main class="scene" id="scene" aria-label="FixMyCity intro animation">
    <h1 class="sr-only">FixMyCity</h1>
    <p class="sr-only">Report. Track. Resolve.</p>
    <div class="night" id="night" aria-hidden="true"></div>
    <svg class="arrival-trail" id="arrival-trail" viewBox="0 0 42 150" aria-hidden="true">
      <path d="M22 0 C36 29 8 63 17 95 Q22 116 21 137" fill="none" stroke="#063369" stroke-width="5" stroke-linecap="round"/>
    </svg>
    <div class="arrival" id="arrival" aria-hidden="true"></div>

    <div class="lockup" id="lockup">
      <svg class="art" id="art" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle id="halo" class="halo" cx="600" cy="360" r="0" fill="#477caf"/>
        <circle id="ripple" class="ripple" cx="600" cy="360" r="0" fill="none" stroke="#b3d5ff" stroke-width="2.5"/>
        <circle id="ripple-two" class="ripple" cx="600" cy="360" r="0" fill="none" stroke="#2788fe" stroke-width="1.5"/>

        <g id="accents">
          <g class="accent" data-x="75" data-y="185" data-rotate="-16" data-delay="0" color="#86baff">
            <path d="M-18-9h10l4-6H7l4 6h9v27h-38z"/><circle cx="1" cy="4" r="8"/>
          </g>
          <g class="accent" data-x="1075" data-y="155" data-rotate="16" data-delay="80" color="#ffd447">
            <path d="M0 24S-16 5-16-5a16 16 0 0 1 32 0C16 5 0 24 0 24Z"/><circle cx="0" cy="-5" r="5"/>
          </g>
          <g class="accent" data-x="1120" data-y="510" data-rotate="-14" data-delay="160" color="#a4c9fa">
            <rect x="-17" y="-20" width="34" height="40" rx="6"/><path d="m-8 0 6 6 12-13"/>
          </g>
          <g class="accent" data-x="120" data-y="620" data-rotate="24" data-delay="100" color="#fff">
            <circle r="11"/>
          </g>
          <g class="accent" data-x="925" data-y="658" data-rotate="35" data-delay="200" color="#77aef5">
            <rect x="-10" y="-10" width="20" height="20" rx="3"/>
          </g>
          <g class="accent" data-x="365" data-y="48" data-rotate="-20" data-delay="40" color="#a4c9fa">
            <path d="M-10-17q20 9 6 20t8 20"/>
          </g>
          <g class="accent" data-x="1128" data-y="315" data-rotate="0" data-delay="140" color="#ffd447">
            <path d="M-8 0H8M0-8V8"/>
          </g>
        </g>

        <g id="logo-motion">
          <g transform="translate(50 0)">
            <!-- One continuous skyline joins the dots of the two lowercase i letters. -->
            <path id="skyline" class="skyline" pathLength="1" d="M121.221 341.061 H178 V309 H210 V322 H231 V269 H270 V322 H300 V216 H310 V177 H320 V148 H329 V126 H337 V106 H343 L345 73 L348 106 H354 V126 H363 V148 H372 V177 H381 V216 H390 V248 H422 V216 H431 V177 H440 V148 H449 V126 H457 V106 H463 L465 73 L468 106 H474 V126 H483 V148 H492 V177 H501 V216 H510 V322 H548 V270 H589 V329 H615 V341 H640 L647 205 L667 175 V119 L686 100 L688 40 L693 100 V135 L710 152 V267 L722 291 V330 H742 V290 H773 V324 H804 V341.061 H829.092"/>
            <!-- Outlined lettering is embedded below: no fonts, images or libraries are fetched. -->
            <g id="wordmark" aria-label="fixmycity">
  <g class="letter" data-letter="f" data-index="0" fill="#2788FE"><path d="M21.824 500V401.316H0V370.477H21.824V368.579Q21.824 353.159 27.874 342.484Q33.923 331.809 45.309 326.116Q56.696 320.423 72.827 320.423Q75.911 320.423 79.469 320.779Q83.028 321.134 85.4 321.609V351.973Q83.028 351.499 81.249 351.38Q79.469 351.262 77.572 351.262Q67.608 351.262 62.508 355.65Q57.408 360.039 57.408 368.579V370.477H85.163V401.316H57.408V500Z"/></g>
  <g class="letter" data-letter="i" data-index="1" fill="#2788FE"><path d="M103.429 500V370.477H139.012V500Z"/></g>
  <g class="letter" data-letter="x" data-index="2" fill="#2788FE"><path d="M154.906 500 200.216 435.001 154.669 370.477H195.946L230.106 420.768H212.077L246.237 370.477H287.513L241.967 435.001L287.039 500H246L212.551 449.709H229.631L196.183 500Z"/></g>
  <g class="letter" data-letter="m" data-index="3" fill="#FFFFFF"><path d="M303.17 500V370.477H336.381V402.027L332.823 396.808Q335.67 381.863 346.582 374.747Q357.494 367.63 372.676 367.63Q388.807 367.63 401.024 375.814Q413.241 383.998 416.325 397.757L406.125 398.706Q412.53 382.812 424.391 375.221Q436.252 367.63 452.146 367.63Q466.142 367.63 476.936 373.798Q487.729 379.965 493.897 390.996Q500.065 402.027 500.065 416.735V500H464.481V424.326Q464.481 416.735 461.753 411.279Q459.025 405.823 454.044 402.739Q449.062 399.655 441.945 399.655Q435.066 399.655 429.965 402.739Q424.865 405.823 422.137 411.279Q419.409 416.735 419.409 424.326V500H383.826V424.326Q383.826 416.735 381.098 411.279Q378.37 405.823 373.388 402.739Q368.406 399.655 361.29 399.655Q354.41 399.655 349.31 402.739Q344.21 405.823 341.482 411.279Q338.754 416.735 338.754 424.326V500Z"/></g>
  <g class="letter" data-letter="y" data-index="4" fill="#FFFFFF"><path d="M543.714 552.189Q538.02 552.189 532.683 551.24Q527.345 550.291 523.312 548.156V518.978Q526.634 519.927 531.141 520.638Q535.648 521.35 539.444 521.35Q549.881 521.35 554.389 516.487Q558.896 511.624 561.743 505.456L570.52 485.292L570.045 514.945L513.112 370.477H551.305L589.023 473.194H574.79L612.508 370.477H650.701L595.191 512.098Q589.972 525.383 582.381 534.397Q574.79 543.412 565.182 547.8Q555.575 552.189 543.714 552.189Z"/></g>
  <g class="letter" data-letter="c" data-index="5" fill="#2788FE"><path d="M729.933 502.847Q710.481 502.847 694.943 493.951Q679.405 485.055 670.272 469.636Q661.139 454.216 661.139 435.001Q661.139 415.786 670.153 400.485Q679.168 385.184 694.824 376.407Q710.481 367.63 729.933 367.63Q744.404 367.63 756.739 372.612Q769.075 377.593 777.852 386.489Q786.629 395.385 790.425 407.483L759.586 420.768Q756.265 411.042 748.318 405.348Q740.371 399.655 729.933 399.655Q720.681 399.655 713.446 404.162Q706.211 408.669 702.06 416.735Q697.908 424.801 697.908 435.238Q697.908 445.676 702.06 453.742Q706.211 461.807 713.446 466.314Q720.681 470.822 729.933 470.822Q740.608 470.822 748.436 465.128Q756.265 459.435 759.586 449.709L790.425 463.231Q786.867 474.617 778.089 483.632Q769.312 492.646 756.976 497.746Q744.641 502.847 729.933 502.847Z"/></g>
  <g class="letter" data-letter="i" data-index="6" fill="#2788FE"><path d="M811.3 500V370.477H846.884V500Z"/></g>
  <g class="letter" data-letter="t" data-index="7" fill="#2788FE"><path d="M935.368 501.423Q911.883 501.423 898.954 488.732Q886.025 476.041 886.025 453.267V401.316H864.201V370.477H865.387Q875.35 370.477 880.688 365.495Q886.025 360.513 886.025 350.55V341.061H921.609V370.477H951.973V401.316H921.609V450.895Q921.609 457.537 923.981 461.926Q926.353 466.314 931.335 468.449Q936.317 470.584 943.67 470.584Q945.331 470.584 947.466 470.347Q949.601 470.11 951.973 469.873V500Q948.415 500.474 943.908 500.949Q939.4 501.423 935.368 501.423Z"/></g>
  <g class="letter" data-letter="y" data-index="8" fill="#2788FE"><path d="M993.013 552.189Q987.319 552.189 981.982 551.24Q976.644 550.291 972.612 548.156V518.978Q975.933 519.927 980.44 520.638Q984.947 521.35 988.743 521.35Q999.181 521.35 1003.688 516.487Q1008.195 511.624 1011.042 505.456L1019.819 485.292L1019.344 514.945L962.411 370.477H1000.604L1038.322 473.194H1024.089L1061.807 370.477H1100L1044.49 512.098Q1039.271 525.383 1031.68 534.397Q1024.089 543.412 1014.481 547.8Q1004.874 552.189 993.013 552.189Z"/></g>
</g>
<circle id="i-dot-start" class="i-dot" cx="121.221" cy="341.061" r="17.792" fill="#FFD447"/>
<circle id="i-dot-end" class="i-dot" cx="829.092" cy="341.061" r="17.792" fill="#FFD447"/>

            <circle id="traveler" cx="550" cy="360" r="17.792" fill="#ffd447"/>
          </g>
          <text id="tagline" x="600" y="628">Report. Track. Resolve.</text>
        </g>
      </svg>
    </div>
    <div class="closing-wipe" id="closing-wipe" aria-hidden="true"></div>
  </main>

  <script src="intro.js"></script>
</body>
</html>
`;
}
