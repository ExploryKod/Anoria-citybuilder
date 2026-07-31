import { createBalanceSheet } from '../read-models/BalanceSheet.js';

/**
 * @param {object} params
 * @param {object} params.treasurySnapshot
 * @param {{ totalValue: number }} params.buildingValuation
 * @param {Array<{ type: string, amount: number }>} params.activeLoans
 */
export function balanceSheetFromTreasuryAndAssets({
  treasurySnapshot,
  buildingValuation,
  activeLoans = [],
}) {
  const tangibleGross = Math.round(buildingValuation.totalValue ?? 0);
  const depreciation = 0;
  const tangibleNet = tangibleGross - depreciation;
  const cash = Math.round(treasurySnapshot.funds ?? 0);
  const receivables = 0;
  const totalAssets = tangibleNet + cash + receivables;

  let bankLoans = 0;
  let commercialLoans = 0;
  for (const loan of activeLoans) {
    const amount = Math.round(loan.amount ?? 0);
    if (loan.type === 'bank') bankLoans += amount;
    else if (loan.type === 'commercial') commercialLoans += amount;
  }

  const shareCapital = Math.round(
    treasurySnapshot.initialFunds ?? treasurySnapshot.funds ?? 0
  );
  let netResult = Math.round(treasurySnapshot.netFlow ?? 0);
  const accruedExpenses = Math.round(
    (treasurySnapshot.totalLoanInterestExpenses ?? 0) +
      (treasurySnapshot.totalBuildingMaintenance ?? 0)
  );

  let totalLiabilities =
    shareCapital + netResult + bankLoans + commercialLoans + accruedExpenses;

  const sheet = createBalanceSheet({
    asOfTurn: treasurySnapshot.turn ?? 0,
    assets: {
      tangibleGross,
      depreciation,
      tangibleNet,
      cash,
      receivables,
      total: totalAssets,
    },
    liabilities: {
      shareCapital,
      netResult,
      bankLoans,
      commercialLoans,
      accruedExpenses,
      total: totalLiabilities,
    },
  });

  if (!sheet.balanced && sheet.balanceAdjustment) {
    netResult += sheet.balanceAdjustment;
    totalLiabilities = shareCapital + netResult + bankLoans + commercialLoans + accruedExpenses;
    return createBalanceSheet({
      asOfTurn: treasurySnapshot.turn ?? 0,
      assets: {
        tangibleGross,
        depreciation,
        tangibleNet,
        cash,
        receivables,
        total: totalAssets,
      },
      liabilities: {
        shareCapital,
        netResult,
        bankLoans,
        commercialLoans,
        accruedExpenses,
        total: totalAssets,
      },
    });
  }

  return sheet;
}

/**
 * Bilan linked to CR — netResult on passif equals incomeStatement.netResult.
 *
 * @param {object} params
 * @param {number} params.atTurn
 * @param {import('../read-models/IncomeStatement.js').IncomeStatement} params.incomeStatement
 * @param {number} params.cash
 * @param {number} params.shareCapital
 * @param {{ totalValue: number }} params.buildingValuation
 * @param {number} [params.bankLoans]
 * @param {number} [params.commercialLoans]
 * @param {number} [params.accruedExpenses]
 */
export function balanceSheetLinkedToIncomeStatement({
  atTurn,
  incomeStatement,
  cash,
  shareCapital,
  buildingValuation,
  bankLoans = 0,
  commercialLoans = 0,
}) {
  const tangibleGross = Math.round(buildingValuation.totalValue ?? 0);
  const tangibleNet = tangibleGross;
  const receivables = 0;
  const roundedCash = Math.round(cash);
  const totalAssets = tangibleNet + roundedCash + receivables;

  const netResult = Math.round(incomeStatement.netResult);
  const roundedShareCapital = Math.round(shareCapital);
  const roundedBankLoans = Math.round(bankLoans);
  const roundedCommercialLoans = Math.round(commercialLoans);

  const baseLiabilities =
    roundedShareCapital + netResult + roundedBankLoans + roundedCommercialLoans;
  const equityReconciliation = Math.round(totalAssets - baseLiabilities);

  return createBalanceSheet({
    asOfTurn: atTurn,
    assets: {
      tangibleGross,
      depreciation: 0,
      tangibleNet,
      cash: roundedCash,
      receivables,
      total: totalAssets,
    },
    liabilities: {
      shareCapital: roundedShareCapital,
      netResult,
      bankLoans: roundedBankLoans,
      commercialLoans: roundedCommercialLoans,
      accruedExpenses: 0,
      equityReconciliation,
      total: totalAssets,
    },
  });
}
