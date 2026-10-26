import { accountKeyOf } from '../../domain/policies/AccountKeyPolicy.js';
import { aidEntriesOf, companyAidOf } from '../../domain/policies/CompanyAidLedgerPolicy.js';
import { dividendOf, monthlyInterestOf, repaymentOf, stakeOf } from '../../domain/policies/CompanyAidPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/**
 * Application service — what the companies the city helped owe it back (see CompanyAidCatalog.js), settled after the month's charges:
 *   - every month, the interest of a loan of working capital once its grace period is over, as far as the company's cash goes, and a repayment of the loan out of the month's
 *     profit (never more than the company owes and holds, nothing in a month it lost);
 *   - every January, the dividend of the year before to the city as a shareholder: its stake in what the company can distribute, at the policy's payout rate.
 * Each line is written on both accounts (the company's and the city's) and once (its business key names the account and the month or the year). Nothing is stored: the loan, its
 * terms, the stake and the results are read from the journal's lines.
 */
export class SettleCompanyAid {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ buildingId: string, name: string }>>} deps.listCompanies the companies (a building's own account) the aid can concern
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {() => Promise<import('../../domain/policies/LegsFold.js').LegsFold>} deps.getLegsFold
   * @param {(buildingId: string) => Promise<number>} deps.companyFundsOf a company's cash, in euros
   * @param {() => Promise<{ dividendPayoutRate: number }>} deps.getCompanyAidPolicy
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /** @param {{ time: number }} params the turn the lines are dated by */
  async execute({ time }) {
    const timeInfo = this.deps.getTimeInfo(time);
    const hamletId = requireActiveHamletId();
    // One pass over the journal for every company: each then reads the few lines of aid.
    const entries = aidEntriesOf(await this.deps.getJournalEntries());
    const fold = await this.deps.getLegsFold();
    const companies = await this.deps.listCompanies();
    const monthKey = timeInfo.year * MONTHS_PER_YEAR + timeInfo.monthIndex;
    const stamp = `${timeInfo.month} ${timeInfo.year}`;
    const toCentimes = (euros) => Math.round(euros * 100);
    // The result of an account over some months: its products (7) less its charges (6), read from the fold, in centimes.
    const resultOf = (totals) => {
      let result = 0;
      for (const [account, total] of totals ?? []) {
        if (account[0] === '7') result += total.credit - total.debit;
        else if (account[0] === '6') result -= total.debit - total.credit;
        else if (account === '12') result += total.credit - total.debit;
      }
      return result;
    };
    const monthTotals = fold.totalsByAccount({ hamletId, fromKey: monthKey, toKey: monthKey });
    const isJanuary = timeInfo.monthIndex === 0 && timeInfo.year > 0;
    const yearTotals = isJanuary ? fold.totalsByAccount({ hamletId, year: timeInfo.year - 1 }) : null;
    const allTotals = isJanuary ? fold.totalsByAccount({ hamletId, untilYear: timeInfo.year - 1 }) : null;
    const policy = await this.deps.getCompanyAidPolicy();

    for (const { buildingId, name } of companies) {
      const accountKey = accountKeyOf({ accountBuildingId: buildingId });
      const aid = companyAidOf(entries, buildingId);
      const line = (type, centimes, label, businessType, side) => ({
        turn: time,
        type,
        amount: centimes / 100,
        description: `${label} ${name} - ${stamp}`,
        businessKey: `${businessType}:${hamletId}:${accountKey}:${businessType === 'state_dividend' ? timeInfo.year : `${timeInfo.year}:${timeInfo.monthIndex}`}`,
        buildingInstanceId: buildingId,
        ...(side === 'company' ? { accountBuildingId: buildingId, counterpartyBuildingId: null } : { accountBuildingId: null, counterpartyBuildingId: buildingId }),
      });
      let cash = toCentimes(await this.deps.companyFundsOf(buildingId));

      if (aid.outstanding > 0) {
        // The interest first: what each loan costs this month on its own terms, once its grace period is over, no more than the company holds.
        const due = aid.loans.reduce(
          (sum, loan) =>
            sum +
            monthlyInterestOf({
              outstanding: loan.outstanding,
              annualRate: loan.terms.interestRate,
              monthsSinceGranted: monthKey - loan.lentKey,
              startsAfterMonths: loan.terms.interestStartsAfterMonths,
              monthsPerYear: MONTHS_PER_YEAR,
            }),
          0,
        );
        const interest = Math.min(Math.max(0, cash), due);
        if (interest > 0) {
          await this.#record(line('aid_interest_paid', interest, 'Intérêts du prêt de la ville versés par', 'aid_interest', 'company'));
          await this.#record(line('aid_interest_received', interest, 'Intérêts du prêt de la ville reçus de', 'aid_interest', 'city'));
          cash -= interest;
        }
        // The repayment: what the company earned this month, as far as it owes and holds.
        const repayment = repaymentOf({ outstanding: aid.outstanding, monthResult: resultOf(monthTotals.get(accountKey)), cash });
        if (repayment > 0) {
          await this.#record(line('aid_loan_repaid', repayment, 'Prêt de la ville remboursé par', 'aid_repayment', 'company'));
          await this.#record(line('aid_loan_repayment_received', repayment, 'Prêt remboursé par', 'aid_repayment', 'city'));
          cash -= repayment;
        }
      }

      if (isJanuary && aid.shareholderCapital > 0) {
        const dividend = dividendOf({
          stake: stakeOf(aid),
          payoutRate: policy.dividendPayoutRate,
          yearResult: resultOf(yearTotals.get(accountKey)) - carriedOf(yearTotals.get(accountKey)),
          accumulatedResult: resultOf(allTotals.get(accountKey)),
          cash,
        });
        if (dividend > 0) {
          await this.#record(line('state_dividend_paid', dividend, 'Dividendes versés à la ville par', 'state_dividend', 'company'));
          await this.#record(line('state_dividend_received', dividend, 'Dividendes reçus de', 'state_dividend', 'city'));
        }
      }
    }
  }

  /** A line already written (the month or the year settled twice) is not a defect; any other refusal is. */
  async #record(line) {
    const result = await this.deps.recordLedgerEntry(line);
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[company-aid] the ${line.type} line "${line.description}" was not recorded: ${result.reason}`);
    }
  }
}

/** The result carried by the à-nouveaux of purged years (account 12) is not the year's own: it is taken off a year's result. @returns {number} centimes */
function carriedOf(totals) {
  const carried = totals?.get('12');
  return carried ? carried.credit - carried.debit : 0;
}
