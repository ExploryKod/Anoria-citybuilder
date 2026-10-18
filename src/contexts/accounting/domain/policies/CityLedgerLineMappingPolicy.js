import {
  createCityLedgerYearLines,
} from '../value-objects/CityLedgerYearLines.js';

/**
 * Domain policy — what moved the city's cash in a year, by account → city-ledger line amounts.
 *
 * The city's ledger (the livret) is not a second reader of the journal: it reads the same fold of the journal's legs as the treasury, the grand livre and the
 * balance (LegsFold), through the M57 accounts of the city's own account. Each line of the livret is the money that came from, or went to, some accounts of the
 * M57 chart (PcgJournalCatalog): an account the city booked money against that no line takes throws, naming it, so no flow of the city is left out of the ledger.
 */

/** The M57 accounts of what came in, and of what went out, for each line. A line may also take off what went the other way (a refund). */
const LINES = Object.freeze({
  initialFunds: { in: ['1021'] },
  incomeTax: { in: ['73111'] },
  // The income tax the households paid, less what the city gave back at the year's close (an advance that was too high): a refund reduces the line it comes
  // from, so the ledger's totals still agree with the treasury.
  payrollTax: { in: ['738'], takeOff: ['7398'] },
  vat: { in: ['735'] },
  exports: { in: ['7348'] },
  // The duty our merchants pay on what they import: the city's income.
  customsImport: { in: ['73431'] },
  // The social contributions, the employers' and the employees', held by the city's social security (it pays the unemployment benefit out of them).
  // What a company owed and paid late reaches the cash against the receivable the city booked (4387 for the contributions, 411 for the tax).
  socialContributions: { in: ['431', '4387'] },
  loanCapital: { in: ['1641'] },
  corporateTaxRevenue: { in: ['73118', '411'] },
  // The constructions, and the founding capital the city pays the companies: both are the city's investments, one line; a refund takes off.
  // A building the city holds through the owner (261), its own building (2131) or its roads (2151).
  construction: { out: ['2131', '261', '2151'], takeOff: ['2131', '261', '2151'] },
  // The upkeep of the buildings the hamlet does not run itself is the rent it pays their owner: one line, "Entretien".
  maintenance: { out: ['6156', '613'] },
  salary: { out: ['6411'] },
  unemploymentBenefit: { out: ['431'] },
  serviceSubsidy: { out: ['65738'] },
  companySubsidy: { out: ['65742'] },
  housingSubsidy: { out: ['65741'] },
  repairs: { out: ['615221'] },
  commercialRoutes: { out: ['622'] },
  contributions: { out: ['6281'] },
  imports: { out: ['607'] },
  loanInterest: { out: ['66111'] },
  loanRepayment: { out: ['1641'] },
});

const INCOME_LINES = ['initialFunds', 'incomeTax', 'payrollTax', 'vat', 'corporateTaxRevenue', 'exports', 'customsImport', 'socialContributions', 'loanCapital'];
const EXPENSE_LINES = [
  'construction', 'maintenance', 'salary', 'unemploymentBenefit', 'serviceSubsidy', 'companySubsidy', 'housingSubsidy', 'repairs', 'commercialRoutes',
  'contributions', 'imports', 'loanInterest', 'loanRepayment',
];

/**
 * @param {number} year the fiscal year
 * @param {Map<string, { in: number, out: number }>} flows what moved the city's cash that year, by account, in centimes (LegsFold.cashFlowsOf)
 * @param {{ balanceForYear: number, previousNetFlow: number }} figures
 *   `balanceForYear`: the cash of the year-end (the treasury's); `previousNetFlow`: the year before's net flow, carried into this year (a gain on the income
 *   side, a loss on the expense side). It is not added to the totals: the year's totals are its own flows.
 * @returns {import('../value-objects/CityLedgerYearLines.js').CityLedgerYearLines}
 */
export function cityLedgerYearLinesFromCashFlows(year, flows, { balanceForYear, previousNetFlow }) {
  const mapped = new Set(Object.values(LINES).flatMap((line) => [...(line.in ?? []), ...(line.out ?? []), ...(line.takeOff ?? [])]));
  for (const account of flows.keys()) {
    if (!mapped.has(account)) throw new Error(`[city-ledger] the city's cash moved against the account ${account}, which no line of its ledger takes`);
  }
  const centimes = (line) => {
    const rule = LINES[line];
    const sum = (accounts, side) => (accounts ?? []).reduce((total, account) => total + (flows.get(account)?.[side] ?? 0), 0);
    // A refund is money that came in against an account the line paid out (a construction refunded) or money that went out against one the line took in (a tax refunded).
    return sum(rule.in, 'in') + sum(rule.out, 'out') - (rule.in ? sum(rule.takeOff, 'out') : sum(rule.takeOff, 'in'));
  };
  const euros = (line) => Math.round(centimes(line) / 100);
  const carryForwardIncome = previousNetFlow >= 0 ? previousNetFlow : 0;
  const carryForwardExpense = previousNetFlow < 0 ? -previousNetFlow : 0;
  const totalIncome = INCOME_LINES.reduce((sum, line) => sum + centimes(line), 0) / 100;
  const totalExpenses = EXPENSE_LINES.reduce((sum, line) => sum + centimes(line), 0) / 100;

  return createCityLedgerYearLines({
    year,
    initialFunds: euros('initialFunds'),
    incomeTax: euros('incomeTax'),
    payrollTax: euros('payrollTax'),
    vat: euros('vat'),
    exports: euros('exports'),
    customsImport: euros('customsImport'),
    socialContributions: euros('socialContributions'),
    loanCapital: euros('loanCapital'),
    carryForwardIncome: Math.round(carryForwardIncome),
    totalIncome: Math.round(totalIncome),
    construction: euros('construction'),
    maintenance: euros('maintenance'),
    salary: euros('salary'),
    unemploymentBenefit: euros('unemploymentBenefit'),
    serviceSubsidy: euros('serviceSubsidy'),
    corporateTaxRevenue: euros('corporateTaxRevenue'),
    companySubsidy: euros('companySubsidy'),
    housingSubsidy: euros('housingSubsidy'),
    repairs: euros('repairs'),
    commercialRoutes: euros('commercialRoutes'),
    contributions: euros('contributions'),
    imports: euros('imports'),
    loanInterest: euros('loanInterest'),
    loanRepayment: euros('loanRepayment'),
    carryForwardExpense: Math.round(carryForwardExpense),
    totalExpenses: Math.round(totalExpenses),
    balance: Math.round(balanceForYear),
  });
}
