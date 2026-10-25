import { accountKeyOf } from '../../domain/policies/AccountKeyPolicy.js';
import { foundedAccountsOf, foundingCapitalOf } from '../../domain/policies/FoundingCapitalPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Application service — the founding capital of the companies. Before a month is settled, every company (and every house's business) that has not received
 * its capital yet gets it from the city: a payment of the city's (a holding of its own, 261) and the company's capital (101), once and never repaid. The
 * amount is what its month costs at full staffing, for the months the catalog sets. Whether a company has been funded is read from the journal.
 */
export class FundNewCompanies {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ buildingId: string, accountKind: string | null, monthlyNeed: number, stockValue: number, name: string }>>} deps.listFoundingNeeds the companies and the businesses of
   *   the houses, with what their month costs at full staffing and what their stock is worth when full (euros) and the name the journal calls them by
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
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
    for (const { buildingId, accountKind, monthlyNeed, stockValue, name } of await this.deps.listFoundingNeeds()) {
      const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
      if (founded.has(accountKey)) continue;
      const capital = foundingCapitalOf(monthlyNeed, stockValue);
      if (capital <= 0) continue;
      const common = { turn: time, amount: capital / 100, buildingInstanceId: buildingId };
      await this.#record({ ...common, type: 'company_capital_paid', description: `Fonds propres versés à ${name} - ${monthLabel}`, businessKey: `company_capital_paid:${hamletId}:${accountKey}`, accountBuildingId: null, counterpartyBuildingId: buildingId });
      await this.#record({ ...common, type: 'company_capital_received', description: `Fonds propres reçus de la ville par ${name} - ${monthLabel}`, businessKey: `company_capital_received:${hamletId}:${accountKey}`, accountBuildingId: buildingId, accountKind });
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
