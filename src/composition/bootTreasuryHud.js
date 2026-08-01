/**
 * Boot treasury + HUD funds for a new game session.
 */

import {
  forceReinitializeTreasury,
  getTreasurySnapshot,
  setBudgetReadyPromise,
  readInitialFundsFromImportMeta,
} from '../js/acl/accountingGame.js';

/**
 * @param {object} params
 * @param {{ updateFunds: (n: number) => void }} params.gameUI
 * @returns {number} initialFunds
 */
export function bootTreasuryHud({ gameUI }) {
  const initialFunds = readInitialFundsFromImportMeta();

  setBudgetReadyPromise(
    forceReinitializeTreasury(initialFunds).then(async () => {
      const initialBudget = await getTreasurySnapshot();
      console.log('[Game] Budget initialized, current budget:', initialBudget);
      gameUI.updateFunds(initialBudget.funds ?? initialFunds);
      return initialBudget;
    })
  );

  return initialFunds;
}
