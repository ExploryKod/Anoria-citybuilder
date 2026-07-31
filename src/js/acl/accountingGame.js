/**
 * Game-facing ACL — orchestration UI + game loop → Accounting BC.
 *
 * Phase 6 step 1 : entry point unique pour remplacer `window.budgetManager`
 * (primitives BC : `acl/accounting.js`).
 */

import defaultDb from '../../core/persistence/dexie/db.js';
import journalManager from '../stores/JournalManager.js';
import {
  getTreasurySnapshot,
  getTreasuryBalance,
  getFinancialHealth,
  getActiveLoans,
  updateTreasuryTurn,
  recalculateLoanTotals,
  initializeTreasury,
  forceReinitializeTreasury,
  addLoanToPortfolio,
  applyRepaymentToPortfolio,
  advanceLoanInstallmentWithoutPayment,
  getOrCreateAccountingContext,
  recordExceptionalExpense,
  recordCommerceImportExpense,
  recordCommerceExportIncome,
} from './accounting.js';

/**
 * @param {import('dexie').Dexie} [dexieDb]
 */
function resolveDb(dexieDb) {
  return dexieDb ?? defaultDb;
}

export {
  getTreasurySnapshot,
  getTreasuryBalance,
  getFinancialHealth,
  getActiveLoans,
  updateTreasuryTurn,
  recalculateLoanTotals,
  initializeTreasury,
  forceReinitializeTreasury,
  addLoanToPortfolio,
  applyRepaymentToPortfolio,
  advanceLoanInstallmentWithoutPayment,
};

/** @returns {Promise<object>} Treasury row projection for budget UI */
export async function getBudgetSummary() {
  const budget = await getTreasurySnapshot();

  return {
    funds: budget.funds,
    expenses: budget.expenses,
    income: budget.income,
    netFlow: budget.netFlow,
    turn: budget.turn,
    isProfitable: budget.netFlow > 0,
    isInDebt: budget.funds < 0,
    loanDebt: budget.loanDebt || 0,
    totalLoanInterest: budget.totalLoanInterest || 0,
    totalLoanRepayments: budget.totalLoanRepayments || 0,
  };
}

export async function getIncomeBreakdown() {
  const budget = await getTreasurySnapshot();

  return {
    totalIncome: budget.income || 0,
    dailyIncome: budget.dailyIncome || 0,
    taxes: budget.totalTaxes || 0,
    otherIncome: (budget.income || 0) - (budget.totalTaxes || 0),
  };
}

export async function getExpenseBreakdown() {
  const budget = await getTreasurySnapshot();

  return {
    totalExpenses: budget.expenses || 0,
    dailyExpenses: budget.dailyExpenses || 0,
    buildingMaintenance: budget.totalBuildingMaintenance || 0,
    investments: budget.totalInvestments || 0,
  };
}

export async function canAfford(amount) {
  const budget = await getTreasurySnapshot();
  return budget.funds >= amount;
}

/**
 * @param {number} time
 * @returns {Promise<object>}
 */
export async function collectCitizenTaxes(time = 0, options = {}) {
  const dexieDb = resolveDb(options.db);
  const { TimeManager } = await import('../game/utils/TimeManager.js');
  const timeInfo = TimeManager.getTimeInfo(time);

  if (timeInfo.monthIndex !== 10) {
    return getTreasurySnapshot();
  }

  const budget = await getTreasurySnapshot();
  const lastTaxYear = budget.lastTaxYear ?? -1;

  if (timeInfo.year === lastTaxYear) {
    return budget;
  }

  const houses = await dexieDb.houses.toArray();
  const taxBreakdown = {
    'House-Blue': 0,
    'House-Red': 0,
    'House-Purple': 0,
    total: 0,
    population: 0,
  };

  houses.forEach((house) => {
    if (
      house.type &&
      (house.type.includes('House-Blue') ||
        house.type.includes('House-Red') ||
        house.type.includes('House-Purple'))
    ) {
      const pop = house.pop || 0;

      if (pop > 0) {
        const globalObj = typeof window !== 'undefined' ? window : global;
        let citizenTaxAmount = 100;
        if (
          globalObj.financesSectionManager &&
          typeof globalObj.financesSectionManager.citizenTaxAmount === 'number'
        ) {
          citizenTaxAmount = globalObj.financesSectionManager.citizenTaxAmount;
        }
        const taxPerHouse = Math.round(pop * citizenTaxAmount);

        if (house.type.includes('House-Blue')) {
          taxBreakdown['House-Blue'] = Math.round(taxBreakdown['House-Blue'] + taxPerHouse);
        } else if (house.type.includes('House-Red')) {
          taxBreakdown['House-Red'] = Math.round(taxBreakdown['House-Red'] + taxPerHouse);
        } else if (house.type.includes('House-Purple')) {
          taxBreakdown['House-Purple'] = Math.round(taxBreakdown['House-Purple'] + taxPerHouse);
        }

        taxBreakdown.total = Math.round(taxBreakdown.total + taxPerHouse);
        taxBreakdown.population += pop;
      }
    }
  });

  if (taxBreakdown.total > 0 && taxBreakdown.population > 0) {
    const roundedTotal = Math.round(taxBreakdown.total);
    const description = `Impôt Citoyen (${taxBreakdown.population} hab.) - Novembre`;

    await getOrCreateAccountingContext().recordCitizenTaxIncome({
      turn: budget.turn,
      amount: roundedTotal,
      description,
      taxYear: timeInfo.year,
      taxBreakdown,
    });

    return getTreasurySnapshot();
  }

  return budget;
}

export async function recordSalaries(
  salaryPerMonth,
  population,
  description = null,
  turn = null
) {
  const budget = await getTreasurySnapshot();
  const effectiveTurn = turn ?? budget.turn;

  if (
    typeof salaryPerMonth !== 'number' ||
    Number.isNaN(salaryPerMonth) ||
    !Number.isFinite(salaryPerMonth) ||
    salaryPerMonth < 0
  ) {
    console.error(`Invalid salary per month: ${salaryPerMonth}`);
    return budget;
  }

  if (
    typeof population !== 'number' ||
    Number.isNaN(population) ||
    !Number.isFinite(population) ||
    population < 0
  ) {
    console.error(`Invalid population: ${population}`);
    return budget;
  }

  const totalSalary = Math.round(salaryPerMonth * population);

  if (totalSalary > 0) {
    const salaryDescription =
      description || `Salaires fonctionnaires (${population} hab. × ${salaryPerMonth}€)`;

    await getOrCreateAccountingContext().recordSalaryExpense({
      turn: effectiveTurn,
      amount: totalSalary,
      description: salaryDescription,
    });

    return getTreasurySnapshot();
  }

  return budget;
}

export async function recordPayrollTax(
  salaryAmount,
  taxRate,
  description = null,
  turn = null
) {
  const budget = await getTreasurySnapshot();
  const effectiveTurn = turn ?? budget.turn;

  if (
    typeof salaryAmount !== 'number' ||
    Number.isNaN(salaryAmount) ||
    !Number.isFinite(salaryAmount) ||
    salaryAmount < 0
  ) {
    return budget;
  }

  if (
    typeof taxRate !== 'number' ||
    Number.isNaN(taxRate) ||
    !Number.isFinite(taxRate) ||
    taxRate < 0 ||
    taxRate > 1
  ) {
    return budget;
  }

  const taxAmount = Math.round(salaryAmount * taxRate);

  if (taxAmount > 0) {
    const taxDescription =
      description || `Impôt sur les salaires (${Math.round(taxRate * 100)}%)`;

    await getOrCreateAccountingContext().recordPayrollTaxIncome({
      turn: effectiveTurn,
      amount: taxAmount,
      description: taxDescription,
    });

    return getTreasurySnapshot();
  }

  return budget;
}

export async function recordBuildingMaintenance(
  amount,
  description = 'Maintenance bâtiments',
  turn = null,
  options = {}
) {
  const dexieDb = resolveDb(options.db);
  const budget = await getTreasurySnapshot();
  const effectiveTurn = turn ?? budget.turn;

  if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
    console.error(`Invalid building maintenance amount: ${amount}`);
    return budget;
  }

  if (amount > 0) {
    const houses = await dexieDb.houses.toArray();
    const maintenanceBreakdown = {
      houses: 0,
      farms: 0,
      markets: 0,
      roads: 0,
      infrastructure: 0,
      industry: 0,
      total: 0,
    };

    const maintenanceCosts = {
      roads: 2,
      'House-Blue': 3,
      'House-Red': 3,
      'House-Purple': 3,
      'House-2Story': 3,
      Farm: 1,
      Market: 1,
    };

    houses.forEach((house) => {
      if (!house.type) {
        return;
      }

      const type = house.type;
      let cost = 2;

      if (type.includes('roads')) {
        cost = maintenanceCosts.roads;
        maintenanceBreakdown.roads += cost;
      } else if (
        type === 'House-Blue' ||
        type === 'House-Red' ||
        type === 'House-Purple' ||
        type === 'House-2Story' ||
        type.includes('House')
      ) {
        cost = maintenanceCosts['House-Blue'];
        maintenanceBreakdown.houses += cost;
      } else if (type.includes('Farm')) {
        cost = maintenanceCosts.Farm;
        maintenanceBreakdown.farms += cost;
      } else if (type.includes('Market')) {
        cost = maintenanceCosts.Market;
        maintenanceBreakdown.markets += cost;
      } else if (
        type.includes('Well') ||
        type.includes('Fountain') ||
        type.includes('Streetlight')
      ) {
        cost = 2;
        maintenanceBreakdown.infrastructure += cost;
      } else if (type.includes('Windmill') || type.includes('Barn')) {
        cost = 2;
        maintenanceBreakdown.industry += cost;
      }

      maintenanceBreakdown.total += cost;
    });

    await getOrCreateAccountingContext().recordMaintenanceExpense({
      turn: effectiveTurn,
      amount,
      description,
      maintenanceBreakdown,
    });

    return getTreasurySnapshot();
  }

  return budget;
}

export async function recordExceptionalRepairExpense(amount, description) {
  const budget = await getTreasurySnapshot();
  const roundedAmount = Math.round(amount);

  if (roundedAmount <= 0) {
    return budget;
  }

  await recordExceptionalExpense({
    turn: budget.turn,
    amount: roundedAmount,
    description,
  });

  return getTreasurySnapshot();
}

export async function recordCommercialRouteFee(amount, description, partnerId) {
  const budget = await getTreasurySnapshot();
  const roundedAmount = Math.round(amount);

  if (roundedAmount <= 0) {
    return {
      budget,
      recorded: false,
      skipped: true,
      treasuryApplied: false,
      reason: 'zero_amount',
    };
  }

  const result = await getOrCreateAccountingContext().recordCommercialRouteExpense({
    turn: budget.turn,
    amount: roundedAmount,
    description,
    partnerId,
  });

  return {
    budget: result.recorded ? await getTreasurySnapshot() : budget,
    recorded: result.recorded,
    skipped: result.skipped,
    treasuryApplied: result.treasuryApplied,
    reason: result.reason,
  };
}

export async function recordImportExpense(
  amount,
  description,
  productId = 'unknown',
  partnerId = null
) {
  const budget = await getTreasurySnapshot();

  if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
    console.error(`Invalid import expense amount: ${amount}`);
    return budget;
  }

  const roundedAmount = Math.round(amount);
  if (roundedAmount <= 0) {
    return budget;
  }

  await recordCommerceImportExpense({
    turn: budget.turn,
    amount: roundedAmount,
    description,
    productId,
    partnerId,
  });

  return getTreasurySnapshot();
}

export async function recordExportIncome(
  amount,
  description,
  productId = 'unknown',
  partnerId = null
) {
  const budget = await getTreasurySnapshot();

  if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
    console.error(`Invalid export income amount: ${amount}`);
    return budget;
  }

  const roundedAmount = Math.round(amount);
  if (roundedAmount <= 0) {
    return budget;
  }

  await getOrCreateAccountingContext().recordCommerceExportIncome({
    turn: budget.turn,
    amount: roundedAmount,
    description,
    productId,
    partnerId,
  });

  return getTreasurySnapshot();
}

export async function recordLoanCapital(amount, description = 'Loan', loanData = null) {
  const budget = await getTreasurySnapshot();
  const roundedAmount = Math.round(amount);

  if (roundedAmount <= 0) {
    return budget;
  }

  const result = await getOrCreateAccountingContext().recordLoanCapitalIncome({
    turn: budget.turn,
    amount: roundedAmount,
    description,
    loanId: loanData?.id ?? null,
  });

  if (!result.recorded) {
    return getTreasurySnapshot();
  }

  if (loanData) {
    return addLoanToPortfolio(loanData);
  }

  return getTreasurySnapshot();
}

export async function recordLoanInterest(
  amount,
  description = 'Loan Interest',
  loanId = null
) {
  const budget = await getTreasurySnapshot();
  const roundedAmount = Math.round(amount);

  if (roundedAmount <= 0) {
    return budget;
  }

  await getOrCreateAccountingContext().recordLoanInterestExpense({
    turn: budget.turn,
    amount: roundedAmount,
    description,
    loanId,
  });

  return getTreasurySnapshot();
}

export async function recordLoanRepayment(
  amount,
  description = 'Loan Repayment',
  loanId = null
) {
  const budget = await getTreasurySnapshot();
  const roundedAmount = Math.round(amount);

  if (roundedAmount <= 0) {
    return budget;
  }

  const result = await getOrCreateAccountingContext().recordLoanRepaymentExpense({
    turn: budget.turn,
    amount: roundedAmount,
    description,
    loanId,
  });

  if (!result.recorded) {
    return getTreasurySnapshot();
  }

  if (loanId) {
    return applyRepaymentToPortfolio(loanId, amount);
  }

  return getTreasurySnapshot();
}

export async function recordInfoLoanInstallment({
  interestAmount = 0,
  principalAmount = 0,
  loanId,
  loanType = 'bank',
}) {
  const budget = await getTreasurySnapshot();

  if (!loanId) {
    return budget;
  }

  await getOrCreateAccountingContext().recordInfoLoanInstallment({
    turn: budget.turn,
    interestAmount,
    principalAmount,
    loanId,
    loanType,
  });

  return budget;
}

export async function saveBudgetTurnEnrichment(turn, additionalData = {}, options = {}) {
  const dexieDb = resolveDb(options.db);
  const budget = await getTreasurySnapshot();
  const financialHealth = await getFinancialHealth();

  const budgetState = {
    name: `budget_turn_${turn}`,
    turn,
    date: new Date().toISOString(),
    funds: budget.funds,
    income: budget.income,
    expenses: budget.expenses,
    netFlow: budget.netFlow,
    dailyIncome: budget.dailyIncome,
    dailyExpenses: budget.dailyExpenses,
    totalTaxes: budget.totalTaxes,
    totalBuildingMaintenance: budget.totalBuildingMaintenance,
    totalInvestments: budget.totalInvestments,
    totalLoanInterestExpenses: budget.totalLoanInterestExpenses || 0,
    totalLoanRepayments: budget.totalLoanRepayments || 0,
    taxBreakdown: budget.taxBreakdown || null,
    maintenanceBreakdown: budget.maintenanceBreakdown || null,
    population: additionalData.population || 0,
    buildingCounts: additionalData.buildingCounts || {},
    financialHealth,
  };

  try {
    await dexieDb.budget.add(budgetState);
    return budgetState;
  } catch (err) {
    if (err.name === 'ConstraintError') {
      await dexieDb.budget.put(budgetState);
      return budgetState;
    }
    console.error('Error saving budget turn enrichment:', err);
    throw err;
  }
}

async function listBudgetTurnSnapshots(dexieDb = defaultDb) {
  const allBudgets = await dexieDb.budget.toArray();
  return allBudgets
    .filter((row) => row.name.startsWith('budget_turn_'))
    .sort((a, b) => b.turn - a.turn);
}

async function getCurrentGameTurn() {
  try {
    if (typeof window !== 'undefined' && window.gameStore) {
      const turnData = await window.gameStore.getLatestGameItemByField('turn');
      return turnData || 0;
    }
    return 0;
  } catch (error) {
    console.warn('Could not get current turn:', error);
    return 0;
  }
}

export async function cleanupOldBudgetTurnSnapshotsByAge(options = {}) {
  const dexieDb = resolveDb(options.db);
  const allStates = await listBudgetTurnSnapshots(dexieDb);
  const currentTurn = await getCurrentGameTurn();
  const cutoffTurn = currentTurn - 60;
  const oldStates = allStates.filter((state) => state.turn < cutoffTurn);

  if (oldStates.length === 0) {
    return {
      deleted: 0,
      message: 'Aucun état ancien à supprimer',
    };
  }

  for (const state of oldStates) {
    await dexieDb.budget.delete(state.name);
  }

  return {
    deleted: oldStates.length,
    message: `🧹 Nettoyage automatique : ${oldStates.length} état(s) de plus de 60 jours supprimé(s) (tours < ${cutoffTurn})`,
    deletedTurns: oldStates.map((s) => s.turn).sort((a, b) => a - b),
  };
}

export async function cleanupOldJournalEntries(maxAge = 60) {
  return journalManager.cleanupOldJournalEntries(maxAge);
}

export async function flushJournalSessionToDexie() {
  return journalManager.flushSessionToDexie();
}
