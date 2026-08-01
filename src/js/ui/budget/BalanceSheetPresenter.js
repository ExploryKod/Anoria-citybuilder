/**
 * Renders BalanceSheet read model (via presentation policy) into bilan DOM elements.
 */

import { buildBalanceSheetViewModel } from '../../acl/accountingPresentation.js';
import { fetchBuildingBreakdownElementValues } from './BuildingBreakdownEnrichment.js';

/**
 * @param {string} elementId
 * @param {string} value
 */
function updateBalanceSheetElement(elementId, value) {
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
    updateBalanceSheetElement(elementId, value);
  }
}

/**
 * @param {object} params
 * @param {import('../../../contexts/accounting/domain/read-models/BalanceSheet.js').BalanceSheet} params.balanceSheet
 * @param {number} [params.turn]
 * @param {{ totalLoanInterestExpenses?: number, totalBuildingMaintenance?: number }|null} [params.treasurySnapshot]
 * @param {boolean} [params.includeBuildingBreakdown]
 */
export async function renderBalanceSheet({
  balanceSheet,
  turn = 0,
  treasurySnapshot = null,
  includeBuildingBreakdown = true,
}) {
  const viewModel = buildBalanceSheetViewModel({ balanceSheet, turn, treasurySnapshot });
  applyElementValues(viewModel.elementValues);

  if (includeBuildingBreakdown) {
    const buildingDetail = await fetchBuildingBreakdownElementValues();
    applyElementValues(buildingDetail);
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
