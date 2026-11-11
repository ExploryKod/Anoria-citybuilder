/**
 * Which backend draws the 3D scene — the player's choice, from Paramètres (tab Performance). Default: WebGL2.
 *
 * WebGL2 is the backend the game was built and played on. WebGPU is offered as an experiment: it may draw faster, and it may not hold on a given
 * browser or graphics driver (the device can be lost as soon as the scene starts). The choice is read once, when the scene is created: it applies to
 * the next game loaded, never to the one running. The one reader is `isWebGpuEnabled`.
 */

const STORAGE_KEY = 'anoria.webgpuEnabled';

/** @returns {boolean} whether this browser exposes WebGPU at all (it may still refuse an adapter) */
export function isWebGpuExposed() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/** @returns {boolean} */
export function isWebGpuEnabled() {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

/** @param {boolean} enabled */
export function setWebGpuEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}
