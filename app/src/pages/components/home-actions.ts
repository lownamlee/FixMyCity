/** Renders the home-actions interface without a static HTML file. */
export function renderHomeActions(): string {
  return `<svg class="home-action-defs" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="ha-paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e0f6ff"/><stop offset=".5" stop-color="#8cd5ff"/><stop offset="1" stop-color="#43a8ff"/></linearGradient>
  <linearGradient id="ha-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#23adff"/><stop offset="1" stop-color="#0060ed"/></linearGradient>
  <linearGradient id="ha-green" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#42e39e"/><stop offset=".4" stop-color="#08b969"/><stop offset="1" stop-color="#007a49"/></linearGradient>
  <linearGradient id="ha-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe57b"/><stop offset=".45" stop-color="#ffbc13"/><stop offset="1" stop-color="#f28a00"/></linearGradient>
  <linearGradient id="ha-gold-edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffbe32"/><stop offset="1" stop-color="#cb7200"/></linearGradient>
  <linearGradient id="ha-violet" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a38cff"/><stop offset=".5" stop-color="#7754ff"/><stop offset="1" stop-color="#4c29d7"/></linearGradient>
  <linearGradient id="ha-lilac" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f0ff"/><stop offset="1" stop-color="#c6b8ff"/></linearGradient>
  <linearGradient id="ha-shine"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs></svg>
<nav class="shortcuts home-actions" aria-label="Quick actions">
  <button class="shortcut home-action home-action--reports" data-open="reports">
    <svg class="home-action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <ellipse class="ha-ground" cx="25" cy="43" rx="13" ry="2.5" fill="#0276ee" opacity=".12"/>
      <g class="ha-document"><path d="M14 7h15l9 9v23a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V10a3 3 0 0 1 2-3Z" fill="#0864d6"/>
        <path d="M12 5h15l9 9v23a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V8a3 3 0 0 1 2-3Z" fill="url(#ha-paper)" stroke="#0788ff" stroke-width="1.7"/>
        <path d="M13 35V9h12" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M27 5v7a2 2 0 0 0 2 2h7" fill="#e5f9ff" stroke="#0788ff" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M16 17h5" stroke="#087bf0" stroke-width="2.4" stroke-linecap="round"/>
        <path class="ha-report-lines" pathLength="1" d="M16 23h13M16 29h13M16 35h7" fill="none" stroke="#087bf0" stroke-width="2.4" stroke-linecap="round"/>
      </g>
    </svg><span>My reports</span>
  </button>
  <button class="shortcut home-action home-action--alerts" data-open="alerts">
    <svg class="home-action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <ellipse class="ha-ground" cx="24" cy="43" rx="11" ry="2.5" fill="#008b54" opacity=".13"/>
      <g class="ha-radar" fill="none" stroke="#19bd73" stroke-width="2" stroke-linecap="round"><path d="M7 17a14 14 0 0 0 0 12M41 17a14 14 0 0 1 0 12"/><path class="ha-radar-outer" d="M3 14a20 20 0 0 0 0 18M45 14a20 20 0 0 1 0 18" opacity=".4"/></g>
      <g class="ha-pin"><path d="M26 7c-7.7 0-14 6-14 13.5C12 31 26 43 26 43s14-12 14-22.5C40 13 33.7 7 26 7Z" fill="#007440"/>
        <path d="M24 5c-7.7 0-14 6-14 13.5C10 29 24 41 24 41s14-12 14-22.5C38 11 31.7 5 24 5Z" fill="url(#ha-green)"/>
        <path d="M14 18a10 10 0 0 1 10-9" fill="none" stroke="#b0ffdc" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>
        <circle cx="24" cy="18.5" r="6.3" fill="#fff"/><path d="M24 15v4m0 3v.1" fill="none" stroke="#008d53" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg><span>Nearby alerts</span>
  </button>
  <button class="shortcut home-action home-action--leaderboard" data-open="leaderboard">
    <svg class="home-action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <ellipse class="ha-ground" cx="24" cy="43" rx="14" ry="2.5" fill="#c97b00" opacity=".14"/>
      <g class="ha-trophy"><path d="M15 12H7v6c0 7 6 10 11 9M33 12h8v6c0 7-6 10-11 9" fill="none" stroke="#d98b00" stroke-width="4" stroke-linejoin="round"/><path d="M14 10H6v6c0 7 6 10 11 9M34 10h8v6c0 7-6 10-11 9" fill="none" stroke="#ffbf23" stroke-width="3" stroke-linejoin="round"/>
        <path d="M22 27h6v10h-6zM17 36h16v5H17z" fill="url(#ha-gold-edge)"/>
        <path d="M21 26h6v10h-6zM16 35h16v5H16z" fill="url(#ha-gold)"/>
        <path d="M14 7h23l-2 14c-.8 6-5 10-10 10s-9-4-10-10Z" fill="#d88100"/>
        <path d="M12 5h23l-2 14c-.8 6-5 10-10 10s-9-4-10-10Z" fill="url(#ha-gold)"/>
        <path d="m16 9 1 10c.3 3 1.8 5 4 6" fill="none" stroke="#fff3b0" stroke-width="2.8" stroke-linecap="round"/>
        <path d="m24 11 1.9 3.8 4.1.6-3 3 .7 4.1-3.7-2-3.7 2 .7-4.1-3-3 4.1-.6Z" fill="#fff8d2"/>
        <path d="M16 35h16" stroke="#ffe994" stroke-width="1.5"/>
      </g><path class="ha-trophy-spark" d="m39 3 1.2 3.8L44 8l-3.8 1.2L39 13l-1.2-3.8L34 8l3.8-1.2Z" fill="#ffc42e"/>
    </svg><span>Leaderboard</span>
  </button>
  <button class="shortcut home-action home-action--certificates" data-open="certificates">
    <svg class="home-action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <ellipse class="ha-ground" cx="25" cy="43" rx="15" ry="2.5" fill="#6335d6" opacity=".13"/>
      <g class="ha-certificate"><rect x="11" y="8" width="26" height="32" rx="3.5" fill="#4e2dc3"/><rect x="8" y="5" width="26" height="32" rx="3.5" fill="url(#ha-violet)"/>
        <rect x="11" y="8" width="20" height="26" rx="1.5" fill="url(#ha-lilac)"/><path d="M15 14h12M15 20h9M15 26h5" stroke="#845cef" stroke-width="2.3" stroke-linecap="round"/>
        <path d="M12 31V10h17" fill="none" stroke="#fff" stroke-width="1.5" stroke-opacity=".85"/>
      </g><g class="ha-stamp"><circle cx="35" cy="33" r="10" fill="#4321ba"/><circle cx="33.5" cy="31.5" r="10" fill="url(#ha-violet)" stroke="#faf6ff" stroke-width="2"/>
        <path class="ha-stamp-check" pathLength="1" d="m29 31.5 3 3 6-6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg><span>Certificates</span>
  </button>
</nav>
<button class="rewards home-rewards" data-open="rewards" aria-label="Your rewards: 120 points and 8 verified contributions">
  <span class="home-reward-stat">
    <svg class="home-reward-medal" viewBox="0 0 48 54" aria-hidden="true" focusable="false">
      <ellipse cx="24" cy="49" rx="15" ry="3" fill="#d79a11" opacity=".15"/>
      <g class="ha-medal"><path d="m9 4 8 19 10-7-6-12Z" fill="#f58a00"/><path d="m25 4-8 19 12 2L40 4Z" fill="url(#ha-gold)"/>
        <circle cx="25.5" cy="33.5" r="16" fill="#cd7d00"/><circle cx="24" cy="31" r="16" fill="url(#ha-gold)"/>
        <circle cx="24" cy="31" r="12.5" fill="none" stroke="#fff0a6" stroke-opacity=".85" stroke-width="1.2"/>
        <path d="m24 21 3 6 6.6 1-4.8 4.7 1.1 6.6-5.9-3.1-5.9 3.1 1.1-6.6-4.8-4.7 6.6-1Z" fill="#fffdf1"/>
        <path d="M13 26a12 12 0 0 1 8-7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
      </g>
    </svg><span class="home-reward-copy"><strong>120 <small>pts</small></strong><span>Contribution points</span></span>
  </span>
  <span class="home-reward-divider" aria-hidden="true"></span>
  <span class="home-reward-stat home-reward-verified">
    <svg class="home-reward-shield" viewBox="0 0 40 44" aria-hidden="true" focusable="false"><circle cx="20" cy="22" r="19" fill="#e1f5dc"/><path d="m21 8 12 5v9c0 8-12 15-12 15S9 30 9 22v-9Z" fill="#007d42"/><path d="m19 6 12 5v9c0 8-12 15-12 15S7 28 7 20v-9Z" fill="url(#ha-green)"/><path d="m12 12 7-3" stroke="#adffcb" stroke-width="1.5" stroke-linecap="round"/><path d="m13 20 4 4 8-8" stroke="#fff" stroke-width="2.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span class="home-reward-copy"><strong>8 <small>verified</small></strong><span>Reports verified</span></span>
  </span>
  <svg class="home-reward-arrow" viewBox="0 0 16 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 6 6 6-6 6"/></svg>
</button>
`;
}
