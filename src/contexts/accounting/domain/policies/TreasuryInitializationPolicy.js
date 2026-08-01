/**
 * @param {number|null|undefined} startingFunds
 * @param {number} defaultInitialFunds
 */
export function resolveStartingFunds(startingFunds, defaultInitialFunds = 200) {
  if (startingFunds !== null && startingFunds !== undefined) {
    return startingFunds;
  }
  return defaultInitialFunds;
}
