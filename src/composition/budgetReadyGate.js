/**
 * Boot gate — construction waits until treasury init completes.
 */

/** @type {Promise<unknown>|null} */
let budgetReadyPromise = null;

/** @param {Promise<unknown>} promise */
export function setBudgetReadyPromise(promise) {
  budgetReadyPromise = promise;
}

/** Resolves when treasury init/reinit completed (game boot). */
export async function awaitBudgetReady() {
  if (budgetReadyPromise) {
    await budgetReadyPromise;
  }
}

/** @internal Tests only */
export function resetBudgetReadyGateForTests() {
  budgetReadyPromise = null;
}
