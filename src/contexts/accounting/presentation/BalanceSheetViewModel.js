import { formatEuro } from './formatMoney.js';

/**
 * @param {object} params
 * @param {import('../domain/read-models/BalanceSheet.js').BalanceSheet} params.balanceSheet
 * @param {number} [params.turn]
 * @param {{ totalLoanInterestExpenses?: number, totalBuildingMaintenance?: number }|null} [params.treasurySnapshot]
 */
export function buildBalanceSheetViewModel({ balanceSheet, turn = 0, treasurySnapshot = null }) {
  const { assets, liabilities } = balanceSheet;
  const totalCurrentAssets = assets.receivables + assets.cash;
  const financialDebtsTotal = liabilities.bankLoans + liabilities.commercialLoans;
  const operatingDebtsTotal = liabilities.accruedExpenses;
  const equityReconciliation = liabilities.equityReconciliation ?? 0;

  /** @type {Record<string, string>} */
  const elementValues = {
    'balance-sheet-date': `Tour ${turn} (état du passif et de l'actif au ${turn}e tour)`,
    'intangible-assets-value': formatEuro(0),
    'establishment-costs': '0€',
    'rd-costs': '0€',
    'patents-licenses': '0€',
    'goodwill': '0€',
    'software-rights': '0€',
    'other-intangible': '0€',
    'intangible-in-progress': '0€',
    'intangible-advances': '0€',
    'total-buildings-gross-value': formatEuro(assets.tangibleGross),
    'land-value': '0€',
    'constructions-value': formatEuro(assets.tangibleGross),
    'technical-equipment': '0€',
    'other-tangible': equityReconciliation !== 0 ? formatEuro(equityReconciliation) : '0€',
    'tangible-in-progress': '0€',
    'tangible-advances': '0€',
    'total-depreciation-value': formatEuro(assets.depreciation),
    'total-buildings-net-value': formatEuro(assets.tangibleNet),
    'financial-assets-value': formatEuro(0),
    'equity-interests': '0€',
    'participation-receivables': '0€',
    'portfolio-securities': '0€',
    'other-securities': '0€',
    'loans-granted': '0€',
    'other-financial': '0€',
    'stocks-work-in-progress': '0€',
    'raw-materials': '0€',
    'work-in-progress': '0€',
    'finished-products': '0€',
    'merchandise': '0€',
    'advances-on-orders': '0€',
    'total-receivables': formatEuro(assets.receivables),
    'client-receivables': '0€',
    'other-receivables': '0€',
    'called-unpaid-capital': '0€',
    'marketable-securities': '0€',
    'own-shares': '0€',
    'treasury-instruments': '0€',
    'cash-value': formatEuro(assets.cash),
    'prepaid-expenses': '0€',
    'total-current-assets': formatEuro(totalCurrentAssets),
    'deferred-charges': '0€',
    'loan-redemption-premiums': '0€',
    'conversion-differences': '0€',
    'total-assets': formatEuro(assets.total),
    'share-capital': formatEuro(liabilities.shareCapital),
    'legal-reserves': '0€',
    'carried-forward': formatEuro(equityReconciliation),
    'net-result': formatEuro(liabilities.netResult),
    'risk-provisions': '0€',
    'charge-provisions': '0€',
    'bank-loans-debt': formatEuro(liabilities.bankLoans),
    'commercial-loans-debt': formatEuro(liabilities.commercialLoans),
    'supplier-debts': '0€',
    'social-fiscal-debts': '0€',
    'accrued-expenses': formatEuro(liabilities.accruedExpenses),
    'loan-interest-expenses': formatEuro(treasurySnapshot?.totalLoanInterestExpenses ?? 0),
    'building-maintenance-expenses': formatEuro(treasurySnapshot?.totalBuildingMaintenance ?? 0),
    'financial-debts-total': formatEuro(financialDebtsTotal),
    'operating-debts-total': formatEuro(operatingDebtsTotal),
    'total-liabilities': formatEuro(liabilities.total),
  };

  return {
    elementValues,
    balanced: balanceSheet.balanced,
    totalAssets: assets.total,
    totalLiabilities: liabilities.total,
    equityReconciliation,
  };
}
