import { accountKeyOf } from '../../domain/policies/AccountKeyPolicy.js';
import { foundedAccountsOf, foundingCapitalOf, workingCapitalOf } from '../../domain/policies/FoundingCapitalPolicy.js';
import { splitWorkingCapital } from '../../domain/policies/CompanyAidPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Application service — the founding capital of the companies. Before a month is settled, every company (and every house's business) that has not received
 * its capital yet gets it from the city: a payment of the city's (a holding of its own, 261) and the company's capital (101), once and never repaid. The
 * amount is what its month costs at full staffing, for the months the catalog sets. A company that carries a stock also gets a working capital, the share of the stock the
 * player's policy sets (see CompanyAidCatalog.js), in the forms it sets: participation (added to the capital above), a loan, or capital as a shareholder (it gives the city a stake).
 * Whether a company has been funded is read from the journal.
 */
export class FundNewCompanies {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ buildingId: string, accountKind: string | null, monthlyNeed: number, stockValue: number, name: string }>>} deps.listFoundingNeeds the companies and the businesses of
   *   the houses, with what their month costs at full staffing and what their stock is worth when full (euros) and the name the journal calls them by
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   * @param {() => Promise<{ workingCapitalShare: number, loanShare: number, shareholderShare: number, loanInterestRate: number, interestStartsAfterMonths: number }>} deps.getCompanyAidPolicy the player's policy now
   */
  constructor(deps) {
    this.deps = deps;
  }

  /** @param {{ time: number }} params the turn the lines are dated by */
  async execute({ time }) {
    const timeInfo = this.deps.getTimeInfo(time);
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    const hamletId = requireActiveHamletId();
    const founded = foundedAccountsOf(await this.deps.getJournalEntries());
    const policy = await this.deps.getCompanyAidPolicy();
    for (const { buildingId, accountKind, monthlyNeed, stockValue, name } of await this.deps.listFoundingNeeds()) {
      const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
      if (founded.has(accountKey)) continue;
      const working = splitWorkingCapital(workingCapitalOf(stockValue, policy.workingCapitalShare), policy);
      const capital = foundingCapitalOf(monthlyNeed) + working.participation;
      const given = (type, centimes, label, businessType) => ({ turn: time, amount: centimes / 100, buildingInstanceId: buildingId, type, description: `${label} ${name} - ${monthLabel}`, businessKey: `${businessType}:${hamletId}:${accountKey}` });
      if (capital > 0) {
        await this.#record({ ...given('company_capital_paid', capital, 'Fonds propres versés à', 'company_capital_paid'), accountBuildingId: null, counterpartyBuildingId: buildingId });
        await this.#record({ ...given('company_capital_received', capital, 'Fonds propres reçus de la ville par', 'company_capital_received'), accountBuildingId: buildingId, accountKind });
      }
      if (working.shareholder > 0) {
        await this.#record({ ...given('shareholder_capital_paid', working.shareholder, 'Fonds propres versés en tant qu’actionnaire à', 'shareholder_capital_paid'), accountBuildingId: null, counterpartyBuildingId: buildingId });
        await this.#record({ ...given('shareholder_capital_received', working.shareholder, 'Fonds propres reçus de la ville actionnaire par', 'shareholder_capital_received'), accountBuildingId: buildingId, accountKind });
      }
      if (working.loan > 0) {
        // The terms are stamped on the loan when it is granted: a later change of the policy does not touch a loan already made.
        const loan = { interestRate: policy.loanInterestRate, interestStartsAfterMonths: policy.interestStartsAfterMonths };
        await this.#record({ ...given('aid_loan_paid', working.loan, 'Fonds de roulement prêté à', 'aid_loan_paid'), accountBuildingId: null, counterpartyBuildingId: buildingId, loan });
        await this.#record({ ...given('aid_loan_received', working.loan, 'Fonds de roulement prêté par la ville à', 'aid_loan_received'), accountBuildingId: buildingId, accountKind, loan });
      }
    }
  }

  /** A company already funded is not funded again; any other refusal is a defect, not a skipped line. */
  async #record(line) {
    const result = await this.deps.recordLedgerEntry(line);
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[founding] the ${line.type} line "${line.description}" was not recorded: ${result.reason}`);
    }
  }
}
