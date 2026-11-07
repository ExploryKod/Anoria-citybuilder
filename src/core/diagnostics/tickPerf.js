/**
 * Whether the `[tick-perf]` timings of a game turn are written to the console (docs/plan/performance.plan.md, step 0).
 *
 * Always in development; in a build, when the player (the designer) asks for them: `localStorage.setItem('show-tick-perf', 'true')` in the console, then reload.
 * `localStorage.removeItem('show-tick-perf')` turns them off.
 * @returns {boolean}
 */
export function tickPerfEnabled() {
  if (import.meta.env?.DEV) return true;
  return typeof localStorage !== 'undefined' && localStorage.getItem('show-tick-perf') === 'true';
}
