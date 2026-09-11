/**
 * PWA support is disabled (2026-09-07) — `vite-plugin-pwa`/`workbox-window`
 * were removed from package.json (see vite.config.js) because workbox-build's
 * dependency tree was tripping Socket Firewall's supply-chain trust check on
 * every `pnpm install`, and the game doesn't need offline/installable
 * support right now. This file stays as a no-op stub with the SAME exported
 * API so its 4 call sites (main.js, bootSiteChrome.js, ParametersPanel.js,
 * settings/main.js) don't need to change.
 *
 * To restore real PWA support: re-add `vite-plugin-pwa`, `workbox-window`,
 * `@vite-pwa/assets-generator` to package.json, re-add the `VitePWA(...)`
 * plugin block to vite.config.js (removed in the same commit as this file —
 * check git history/blame here), and restore the real implementation below
 * (also from git history).
 */

/**
 * No-op — no service worker to register while PWA support is disabled.
 */
export function initPWA() {}

/**
 * @returns {string | null} Always null while PWA support is disabled.
 */
export function getLastPwaUpdateAt() {
  return null;
}

/**
 * @returns {Promise<'unsupported'>} Always 'unsupported' while PWA support is disabled.
 */
export async function installLatestPwaUpdate() {
  return 'unsupported';
}
