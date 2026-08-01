/**
 * BilanPresenter — rendu du read model bilan dans le DOM.
 */

import { buildBalanceSheetViewModel } from '../../../../contexts/accounting/presentation/index.js';
import { fetchBuildingBreakdownElementValues } from './BuildingBreakdownEnrichment.js';

/**
 * @param {string} elementId
 * @param {string} value
 */
function updateBilanElement(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = value;
  }
}

/**
 * @param {Record<string, string>} elementValues
 */
function applyElementValues(elementValues) {
  for (const [elementId, value] of Object.entries(elementValues)) {
    updateBilanElement(elementId, value);
  }
}

/**
 * @param {object} params
 * @param {import('../../../../contexts/accounting/domain/read-models/BalanceSheet.js').BalanceSheet} params.balanceSheet
 * @param {number} [params.turn]
 * @param {{ totalLoanInterestExpenses?: number, totalBuildingMaintenance?: number }|null} [params.treasurySnapshot]
 * @param {boolean} [params.includeBuildingBreakdown]
 * @param {object} [params.accounting]
 * @param {object} [params.construction]
 */
export async function renderBilan({
  balanceSheet,
  turn = 0,
  treasurySnapshot = null,
  includeBuildingBreakdown = true,
  accounting = null,
  construction = null,
}) {
  const viewModel = buildBalanceSheetViewModel({ balanceSheet, turn, treasurySnapshot });
  applyElementValues(viewModel.elementValues);

  if (includeBuildingBreakdown) {
    if (!accounting || !construction) {
      console.warn('[BilanPresenter] building breakdown skipped — accounting/construction deps missing');
    } else {
      const buildingDetail = await fetchBuildingBreakdownElementValues({
        accounting,
        construction,
      });
      applyElementValues(buildingDetail);
    }
  }

  if (viewModel.balanced) {
    console.info(`✅ Bilan équilibré: ACTIF = PASSIF = ${viewModel.totalAssets}€`);
  } else {
    console.warn(
      `⚠️ Bilan déséquilibré: ACTIF (${viewModel.totalAssets}€) ≠ PASSIF (${viewModel.totalLiabilities}€).`
    );
  }

  if (viewModel.equityReconciliation !== 0) {
    console.info(
      `ℹ️ Écart de réconciliation immobilisé: ${viewModel.equityReconciliation}€ (report à nouveau / autres immobilisations)`
    );
  }
}
