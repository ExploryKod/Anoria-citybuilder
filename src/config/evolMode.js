/**
 * Evolution / progression mode — skill-gated building placement.
 *
 * When `isEvolMode()` is true, placement tools unlock via housing level-2 skills.
 * When false, every placeable building is available from the start.
 *
 * Resolution: `VITE_IS_EVOL_MODE` (env). Default: false.
 */

/**
 * @returns {boolean | null}
 */
function readEnvEvolMode() {
  try {
    if (
      typeof import.meta !== 'undefined'
      && import.meta.env
      && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_IS_EVOL_MODE')
    ) {
      const raw = String(import.meta.env.VITE_IS_EVOL_MODE).toLowerCase();
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof window !== 'undefined' && window.__VITE_IS_EVOL_MODE__ !== undefined) {
      const raw = String(window.__VITE_IS_EVOL_MODE__).toLowerCase();
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** @returns {boolean} */
export function isEvolMode() {
  const fromEnv = readEnvEvolMode();
  if (fromEnv !== null) return fromEnv;
  return false;
}
