import { DEFAULT_INITIAL_FUNDS } from '../catalogs/TreasuryCatalog.js';

/**
 * @param {number|null|undefined} startingFunds
 * @param {number} [defaultInitialFunds] Falls back to the canonical
 *   TreasuryCatalog default — callers going through createAccountingContext
 *   always pass the resolved (env-aware) value explicitly.
 */
export function resolveStartingFunds(startingFunds, defaultInitialFunds = DEFAULT_INITIAL_FUNDS) {
  if (startingFunds !== null && startingFunds !== undefined) {
    return startingFunds;
  }
  return defaultInitialFunds;
}
