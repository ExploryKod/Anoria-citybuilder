/**
 * Boot treasury + HUD funds for a new game session.
 */

import { readInitialFundsFromImportMeta } from '../contexts/accounting/domain/catalogs/TreasuryCatalog.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { setBudgetReadyPromise } from './budgetReadyGate.js';

/**
 * @param {object} params
 * @param {{ updateFunds: (n: number) => void }} params.gameUI
 * @param {() => Promise<void>} [params.restoreClock] Restores the game clock before the treasury is read: the turn is the clock's.
 * @param {boolean} params.freshGame True only when the player chose a new game in the menu: the
 *   treasury and journal are then reset. Any other page load (returning from the map, a refresh)
 *   keeps what the save already has.
 * @returns {number} initialFunds
 */
export function bootTreasuryHud({ gameUI, freshGame, restoreClock = async () => {} }) {
  const initialFunds = readInitialFundsFromImportMeta();
  const accounting = getOrCreateAccountingContext();
  const setup = freshGame
    ? accounting.forceReinitializeTreasury(initialFunds)
    : accounting.ensureTreasury(initialFunds);

  setBudgetReadyPromise(
    setup.then(async () => {
      await restoreClock();
      const initialBudget = await accounting.getTreasurySnapshot();
      console.log('[Game] Budget initialized, current budget:', initialBudget);
      gameUI.updateFunds(initialBudget.funds);
      return initialBudget;
    })
  );

  return initialFunds;
}
