/**
 * Boot treasury + HUD funds for a new game session.
 */

import { readInitialFundsFromImportMeta } from '../contexts/accounting/domain/catalogs/TreasuryCatalog.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { setBudgetReadyPromise } from './budgetReadyGate.js';

/**
 * @param {object} params
 * @param {{ updateFunds: (n: number) => void }} params.gameUI
 * @returns {number} initialFunds
 */
export function bootTreasuryHud({ gameUI }) {
  const initialFunds = readInitialFundsFromImportMeta();
  const accounting = getOrCreateAccountingContext();

  setBudgetReadyPromise(
    accounting.forceReinitializeTreasury(initialFunds).then(async () => {
      const initialBudget = await accounting.getTreasurySnapshot();
      console.log('[Game] Budget initialized, current budget:', initialBudget);
      gameUI.updateFunds(initialBudget.funds ?? initialFunds);
      return initialBudget;
    })
  );

  return initialFunds;
}
