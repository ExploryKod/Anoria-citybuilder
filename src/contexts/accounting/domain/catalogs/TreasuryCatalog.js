/** Canonical treasury rules (accounting BC). */

export const DEFAULT_INITIAL_FUNDS = 200;

export const COMMERCIAL_ROUTE_FEE = 500;

/**
 * @param {string | number | null | undefined} envValue
 * @param {number} [fallback=DEFAULT_INITIAL_FUNDS]
 * @returns {number}
 */
export function resolveInitialFundsFromEnv(envValue, fallback = DEFAULT_INITIAL_FUNDS) {
  if (envValue === null || envValue === undefined || envValue === '') {
    return fallback;
  }
  const parsed = parseInt(String(envValue), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Read VITE_INITIAL_FUNDS when running under Vite; safe in Node/Jest. */
export function readInitialFundsFromImportMeta() {
  const envValue =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_INITIAL_FUNDS
      : undefined;
  return resolveInitialFundsFromEnv(envValue);
}
