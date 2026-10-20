/**
 * Boot gate — construction and the clock wait until treasury init completes, and, in a new game, until its opening is over.
 */

/** @type {Promise<unknown>|null} */
let budgetReadyPromise = null;

/** @type {{ promise: Promise<void>, resolve: () => void, reject: (error: unknown) => void } | null} */
let openingGate = null;

/** @param {Promise<unknown>} promise */
export function setBudgetReadyPromise(promise) {
  budgetReadyPromise = promise;
}

/**
 * A new game opens on a dépêche (the mayor's gift, turn 0): the clock must not move before the player has read it. Closed here, at boot,
 * before the game loop can tick; opened by `endOpening` (or failed by `failOpening`, so the cause shows at the first tick instead of a game
 * that never starts).
 */
export function holdBudgetReadyForOpening() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // The awaiters get the rejection; this keeps an early one from being reported as unhandled before the first tick awaits it.
  promise.catch(() => {});
  openingGate = { promise, resolve, reject };
}

/** The opening is over: the clock and construction may start. */
export function endOpening() {
  openingGate?.resolve();
}

/** @param {unknown} error why the opening could not be shown */
export function failOpening(error) {
  openingGate?.reject(error);
}

/** Resolves when treasury init/reinit completed (game boot), whatever the opening. */
export async function awaitTreasuryReady() {
  if (budgetReadyPromise) {
    await budgetReadyPromise;
  }
}

/** Resolves when the treasury is ready and the game's opening, if it has one, is over. */
export async function awaitBudgetReady() {
  await awaitTreasuryReady();
  if (openingGate) {
    await openingGate.promise;
  }
}

/** @internal Tests only */
export function resetBudgetReadyGateForTests() {
  budgetReadyPromise = null;
  openingGate = null;
}
