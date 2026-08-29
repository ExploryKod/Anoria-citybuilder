/**
 * Cheat codes — gated by env (off by default in production builds).
 *
 * Resolution order:
 * 1. `VITE_CHEAT_CODES_ENABLED` (env)
 * 2. `window.__VITE_CHEAT_CODES_ENABLED__` (tests)
 * 3. Default: `true` in Vite DEV, `false` in production
 */

/**
 * @returns {boolean | null}
 */
function readEnvCheatCodesEnabled() {
  try {
    if (
      typeof import.meta !== 'undefined'
      && import.meta.env
      && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_CHEAT_CODES_ENABLED')
    ) {
      const raw = String(import.meta.env.VITE_CHEAT_CODES_ENABLED).toLowerCase();
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof window !== 'undefined' && window.__VITE_CHEAT_CODES_ENABLED__ !== undefined) {
      const raw = String(window.__VITE_CHEAT_CODES_ENABLED__).toLowerCase();
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch {
    /* ignore */
  }

  return null;
}

function readDefaultCheatCodesEnabled() {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/** @returns {boolean} */
export function isCheatCodesEnabled() {
  const fromEnv = readEnvCheatCodesEnabled();
  if (fromEnv !== null) return fromEnv;
  return readDefaultCheatCodesEnabled();
}
