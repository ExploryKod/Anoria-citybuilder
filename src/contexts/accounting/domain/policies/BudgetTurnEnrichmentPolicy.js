import { createBudgetTurnEnrichmentSnapshot } from '../read-models/BudgetTurnEnrichmentSnapshot.js';

/**
 * Builds a budget_turn_* enrichment row from live treasury + optional game data.
 *
 * @param {object} params
 * @param {number} params.turn
 * @param {object} params.treasurySnapshot
 * @param {{ status: string, message: string }} params.financialHealth
 * @param {{ population?: number, buildingCounts?: object }} [params.additionalData]
 */
export function buildBudgetTurnEnrichmentSnapshot({
  turn,
  treasurySnapshot,
  financialHealth,
  additionalData = {},
}) {
  return createBudgetTurnEnrichmentSnapshot({
    turn,
    date: new Date().toISOString(),
    funds: treasurySnapshot.funds,
    income: treasurySnapshot.income,
    expenses: treasurySnapshot.expenses,
    netFlow: treasurySnapshot.netFlow,
    dailyIncome: treasurySnapshot.dailyIncome,
    dailyExpenses: treasurySnapshot.dailyExpenses,
    totalTaxes: treasurySnapshot.totalTaxes,
    totalBuildingMaintenance: treasurySnapshot.totalBuildingMaintenance,
    totalInvestments: treasurySnapshot.totalInvestments,
    totalLoanInterestExpenses: treasurySnapshot.totalLoanInterestExpenses || 0,
    totalLoanRepayments: treasurySnapshot.totalLoanRepayments || 0,
    taxBreakdown: treasurySnapshot.taxBreakdown || null,
    maintenanceBreakdown: treasurySnapshot.maintenanceBreakdown || null,
    population: additionalData.population || 0,
    buildingCounts: additionalData.buildingCounts || {},
    financialHealth,
  });
}
