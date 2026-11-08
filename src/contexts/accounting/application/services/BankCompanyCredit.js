import { accountKeyOf } from '../../domain/policies/AccountKeyPolicy.js';
import { companyCreditAppetiteOf, companyCreditRateOf, monthInterestOf } from '../../domain/policies/LoanRatePolicy.js';
import { repaymentOf } from '../../domain/policies/CompanyAidPolicy.js';
import { COMPANY_CREDIT_CEILING_MONTHS } from '../../domain/catalogs/BankCatalog.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/** A company's account of what it owes the bank: the sub-account of 164 its credit lines post to (PcgJournalCatalog.js). */
const CREDIT_ACCOUNT = '1643';

/**
 * Application service — the bank's credit to the companies (see BankCatalog.js). Nothing is stored: what a company owes the bank is the balance of its 1643, read
 * from the fold of the journal.
 *   - `lend`: a company short of cash for its month's charges borrows the shortfall, up to a ceiling of some months of its charges at full staffing (less what it
 *     already owes), the less of it the dearer the credit, as far as the bank can lend it and keep its reserve (refinanced by a working central bank when it cannot). What the bank does not lend
 *     becomes the company's debt, as before.
 *   - `settleMonth`: each month, every company that owes the bank pays the interest at the policy rate plus the business spread (what its cash cannot pay is added
 *     to the debt, no money moves), then repays out of the month's profit. Each line once (its business key).
 */
export class BankCompanyCredit {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<string | null>} deps.findBankBuildingId the hamlet's bank, null while none is built
   * @param {(params: { turn: number, bankId: string, reservesOut: number, depositsAdded: number }) => Promise<{ covered: boolean }>} deps.coverBankShortfall
   *   whether the bank keeps its reserve once the credit has created the deposit, after its refinancing (BankRefinancing.coverShortfall)
   * @param {() => Promise<{ rate: number }>} deps.getPolicyRateStatus the policy rate in force
   * @param {(buildingId: string) => Promise<number>} deps.monthlyNeedOf what a company's month costs at full staffing, in euros (its founding capital's basis)
   * @param {() => Promise<Array<{ buildingId: string, name: string }>>} deps.listCompanies the companies of the hamlet
   * @param {(buildingId: string) => Promise<number>} deps.cashOf a building's cash, in euros
   * @param {() => Promise<import('../../domain/policies/LegsFold.js').LegsFold>} deps.getLegsFold
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {{ time: number, companyId: string, shortfall: number }} params `shortfall`: what the company lacks for its month, in centimes
   * @returns {Promise<number>} what it borrowed, in centimes (0: the bank lent nothing)
   */
  async lend({ time, companyId, shortfall }) {
    if (!Number.isInteger(shortfall) || shortfall < 0) throw new Error(`[company-credit] a shortfall is a whole number of centimes of zero or more, got ${shortfall}`);
    const bankId = await this.deps.findBankBuildingId();
    // No bank, no credit; and the bank does not lend to itself.
    if (!bankId || bankId === companyId || shortfall === 0) return 0;
    const timeInfo = this.deps.getTimeInfo(time);
    // The dearer the credit, the less of its ceiling the company is willing to take.
    const appetite = companyCreditAppetiteOf(companyCreditRateOf((await this.deps.getPolicyRateStatus()).rate));
    const ceiling = Math.round((await this.deps.monthlyNeedOf(companyId)) * COMPANY_CREDIT_CEILING_MONTHS * appetite * 100);
    const amount = Math.min(shortfall, ceiling - (await this.#outstandingOf(companyId, timeInfo.year)));
    if (amount <= 0) return 0;
    // The credit creates the company's deposit: it takes no reserves, but the bank's deposits grow, and so does the reserve it must keep.
    const { covered } = await this.deps.coverBankShortfall({ turn: time, bankId, reservesOut: 0, depositsAdded: amount / 100 });
    if (!covered) return 0;

    const hamletId = requireActiveHamletId();
    const stamp = `${timeInfo.year}:${timeInfo.monthIndex}`;
    const common = { turn: time, transactionId: `bank_credit:${companyId}:${stamp}`, amount: amount / 100, description: `Crédit de la banque pour payer le mois - ${timeInfo.month} ${timeInfo.year}` };
    const received = await this.deps.recordLedgerEntry({ ...common, type: 'bank_credit_received', businessKey: `bank_credit_received:${hamletId}:${companyId}:${stamp}`, accountBuildingId: companyId, counterpartyBuildingId: bankId });
    // The month already borrowed (a settlement run twice): its cash already holds it, nothing more comes in.
    if (!received.recorded && received.reason === 'duplicate_business_key') return 0;
    if (!received.recorded) throw new Error(`[company-credit] the credit of ${companyId} was not recorded: ${received.reason}`);
    await this.#record({ ...common, type: 'bank_credit_lent', businessKey: `bank_credit_lent:${hamletId}:${companyId}:${stamp}`, accountBuildingId: bankId, counterpartyBuildingId: companyId });
    return amount;
  }

  /** @param {{ time: number }} params the turn the lines are dated by */
  async settleMonth({ time }) {
    const bankId = await this.deps.findBankBuildingId();
    if (!bankId) return;
    const hamletId = requireActiveHamletId();
    const timeInfo = this.deps.getTimeInfo(time);
    const monthKey = timeInfo.year * MONTHS_PER_YEAR + timeInfo.monthIndex;
    const fold = await this.deps.getLegsFold();
    const monthTotals = fold.totalsByAccount({ hamletId, fromKey: monthKey, toKey: monthKey });
    const yearlyRate = companyCreditRateOf((await this.deps.getPolicyRateStatus()).rate);
    const stamp = `${timeInfo.year}:${timeInfo.monthIndex}`;

    for (const { buildingId, name } of await this.deps.listCompanies()) {
      if (buildingId === bankId) continue;
      const outstanding = await this.#outstandingOf(buildingId, timeInfo.year);
      if (outstanding <= 0) continue;
      let cash = Math.round((await this.deps.cashOf(buildingId)) * 100);
      const { interestPaid, interestCapitalised } = monthInterestOf({ outstanding, yearlyRate, cash, monthsPerYear: MONTHS_PER_YEAR });
      cash -= interestPaid;
      // The month's profit after its interest (the month's totals were read before the interest is written).
      const monthResult = resultOf(monthTotals.get(accountKeyOf({ accountBuildingId: buildingId }))) - interestPaid - interestCapitalised;
      const repayment = repaymentOf({ outstanding: outstanding + interestCapitalised, monthResult, cash });

      const pair = async (companyType, bankType, centimes, label) => {
        if (centimes <= 0) return;
        const common = { turn: time, transactionId: `bank_credit:${buildingId}:${companyType}:${stamp}`, amount: centimes / 100, description: `${label} ${name} - ${timeInfo.month} ${timeInfo.year}` };
        await this.#record({ ...common, type: companyType, businessKey: `${companyType}:${hamletId}:${buildingId}:${stamp}`, accountBuildingId: buildingId, counterpartyBuildingId: bankId });
        await this.#record({ ...common, type: bankType, businessKey: `${bankType}:${hamletId}:${buildingId}:${stamp}`, accountBuildingId: bankId, counterpartyBuildingId: buildingId });
      };
      await pair('bank_credit_interest_paid', 'bank_credit_interest_received', interestPaid, 'Intérêts du crédit de la banque :');
      await pair('od_bank_credit_interest_capitalised', 'od_bank_credit_interest_accrued', interestCapitalised, 'Intérêts du crédit ajoutés à la dette :');
      await pair('bank_credit_repaid', 'bank_credit_repayment_received', repayment, 'Crédit de la banque remboursé :');
    }
  }

  /**
   * What a company owes the bank now, read from the fold.
   * @param {string} companyId
   * @param {number} turn
   * @returns {Promise<number>} euros
   */
  async outstanding(companyId, turn) {
    return (await this.#outstandingOf(companyId, this.deps.getTimeInfo(turn).year)) / 100;
  }

  /** @param {string} companyId @param {number} year @returns {Promise<number>} centimes */
  async #outstandingOf(companyId, year) {
    const total = (await this.deps.getLegsFold()).totalsByAccount({ hamletId: requireActiveHamletId(), untilYear: year }).get(accountKeyOf({ accountBuildingId: companyId }))?.get(CREDIT_ACCOUNT);
    return total ? total.credit - total.debit : 0;
  }

  /** A line already written (the month settled twice) is not a defect; any other refusal is. */
  async #record(line) {
    const result = await this.deps.recordLedgerEntry(line);
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[company-credit] the ${line.type} line "${line.description}" was not recorded: ${result.reason}`);
    }
  }
}

/** The result of an account over some months: its products (7) less its charges (6), in centimes, as SettleCompanyAid reads it. */
function resultOf(totals) {
  let result = 0;
  for (const [account, total] of totals ?? []) {
    if (account[0] === '7') result += total.credit - total.debit;
    else if (account[0] === '6') result -= total.debit - total.credit;
  }
  return result;
}
