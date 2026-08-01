/**
 * Read model — UI enrichment snapshot persisted as `budget_turn_{turn}`.
 * Not a source of truth for CR/bilan totals (journal-primary).
 *
 * @typedef {object} BudgetTurnEnrichmentSnapshot
 * @property {number} turn
 * @property {string} date
 * @property {number} funds
 * @property {number} income
 * @property {number} expenses
 * @property {number} netFlow
 * @property {number} dailyIncome
 * @property {number} dailyExpenses
 * @property {number} totalTaxes
 * @property {number} totalBuildingMaintenance
 * @property {number} totalInvestments
 * @property {number} totalLoanInterestExpenses
 * @property {number} totalLoanRepayments
 * @property {object|null} taxBreakdown
 * @property {object|null} maintenanceBreakdown
 * @property {number} population
 * @property {object} buildingCounts
 * @property {{ status: string, message: string }|null} financialHealth
 */

/** @param {Partial<BudgetTurnEnrichmentSnapshot> & Pick<BudgetTurnEnrichmentSnapshot, 'turn'>} data */
export function createBudgetTurnEnrichmentSnapshot(data) {
  return Object.freeze({
    turn: data.turn,
    date: data.date ?? new Date().toISOString(),
    funds: data.funds ?? 0,
    income: data.income ?? 0,
    expenses: data.expenses ?? 0,
    netFlow: data.netFlow ?? 0,
    dailyIncome: data.dailyIncome ?? 0,
    dailyExpenses: data.dailyExpenses ?? 0,
    totalTaxes: data.totalTaxes ?? 0,
    totalBuildingMaintenance: data.totalBuildingMaintenance ?? 0,
    totalInvestments: data.totalInvestments ?? 0,
    totalLoanInterestExpenses: data.totalLoanInterestExpenses ?? 0,
    totalLoanRepayments: data.totalLoanRepayments ?? 0,
    taxBreakdown: data.taxBreakdown ?? null,
    maintenanceBreakdown: data.maintenanceBreakdown ?? null,
    population: data.population ?? 0,
    buildingCounts: data.buildingCounts ?? {},
    financialHealth: data.financialHealth ?? null,
  });
}
