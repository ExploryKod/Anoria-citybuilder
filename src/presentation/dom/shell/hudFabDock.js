/**
 * Game-only dock: cookie + perf FABs, bottom-right, same row as replay.
 */

export function adoptHudFabDockChildren() {
  const dock = document.getElementById('hud-fab-dock');
  if (!dock) return;

  const cookie = document.getElementById('cookieConsentFab');
  const perf = document.getElementById('stats-js');
  if (cookie && cookie.parentElement !== dock) {
    dock.appendChild(cookie);
  }
  if (perf && perf.parentElement !== dock) {
    dock.appendChild(perf);
  }
}
