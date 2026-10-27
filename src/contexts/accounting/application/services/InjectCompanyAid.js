import { accountKeyOf } from '../../domain/policies/AccountKeyPolicy.js';
import { aidEntriesOf, bookEquityOf, companyAidOf } from '../../domain/policies/CompanyAidLedgerPolicy.js';
import { sharePriceOf, sharesBoughtBy, stakeOf } from '../../domain/policies/CompanyAidPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/** The forms the city can put money into a company in, and the lines each writes (see CompanyAidCatalog.js). */
const FORMS = Object.freeze({
  shareholder: Object.freeze({ paid: 'shareholder_capital_paid', received: 'shareholder_capital_received', paidLabel: 'Fonds propres versés en tant qu’actionnaire à', receivedLabel: 'Fonds propres reçus de la ville actionnaire par' }),
  loan: Object.freeze({ paid: 'aid_loan_paid', received: 'aid_loan_received', paidLabel: 'Fonds de roulement prêté à', receivedLabel: 'Fonds de roulement prêté par la ville à' }),
  participation: Object.freeze({ paid: 'company_capital_paid', received: 'company_capital_received', paidLabel: 'Fonds propres versés à', receivedLabel: 'Fonds propres reçus de la ville par' }),
});

export const COMPANY_AID_FORMS = Object.freeze(Object.keys(FORMS));

/**
 * Application service — the player puts money into a company that already lives, in the form he chooses: capital as a shareholder (a stake, and dividends), a loan (on the terms
 * of the policy in force, stamped on it), or a participation (capital with no return). The stake the city holds after a shareholder's contribution is what it has put in as a
 * shareholder is bought at the price of a share then (the company's equity over its shares: what it is worth by its books, see CompanyAidCatalog.js), so a company that has grown
 * costs more to enter than one that has lost money, and the stake is the shares held over all the shares. A participation issues no share: it is capital given, which raises what the
 * existing shares are worth. The money leaves the city's account at once, as the founding capital does.
 */
export class InjectCompanyAid {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<{ buildingId: string, name: string, x: number, y: number }>>} deps.listCompanies
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {() => Promise<import('../../domain/policies/LegsFold.js').LegsFold>} deps.getLegsFold
   * @param {() => Promise<{ loanInterestRate: number, interestStartsAfterMonths: number }>} deps.getCompanyAidPolicy
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * Each company, with what the city holds in it: its capital, the part as a shareholder (and the stake it makes) and what it still owes of loans.
   * @returns {Promise<Array<{ buildingId: string, name: string, x: number, y: number, capital: number, shareholderCapital: number, equity: number, sharePrice: number, shares: number, shareholderShares: number, stake: number, loanOutstanding: number }>>}
   *   amounts in euros, the stake a fraction; `sharePrice` is what a share costs now
   */
  async describe() {
    const entries = aidEntriesOf(await this.deps.getJournalEntries());
    const fold = await this.deps.getLegsFold();
    const hamletId = requireActiveHamletId();
    return (await this.deps.listCompanies()).map(({ buildingId, name, x, y }) => {
      const aid = companyAidOf(entries, buildingId);
      const equity = bookEquityOf(fold.totalsOf({ hamletId, accountKey: accountKeyOf({ accountBuildingId: buildingId }) }));
      return {
        buildingId,
        name,
        x,
        y,
        capital: aid.totalCapital / 100,
        shareholderCapital: aid.shareholderCapital / 100,
        equity,
        sharePrice: sharePriceOf({ equity, totalShares: aid.totalShares }),
        shares: aid.totalShares,
        shareholderShares: aid.shareholderShares,
        stake: stakeOf(aid),
        loanOutstanding: aid.outstanding / 100,
      };
    });
  }

  /**
   * @param {{ buildingId: string, amount: number, form: string, time: number }} params `amount` in euros, `time` the turn the lines are dated by
   * @returns {Promise<{ amount: number, form: string }>}
   */
  async execute({ buildingId, amount, form, time }) {
    const kind = FORMS[form];
    if (!kind) throw new Error(`[company-aid] "${form}" is not a form of aid: ${COMPANY_AID_FORMS.join(', ')}`);
    if (!Number.isFinite(amount) || !(amount > 0)) throw new Error(`[company-aid] the amount put into a company must be more than 0, got ${amount}`);
    const company = (await this.deps.listCompanies()).find((candidate) => candidate.buildingId === buildingId);
    if (!company) throw new Error(`[company-aid] building ${buildingId} is not a company the city can put money into`);
    const centimes = Math.round(amount * 100);
    const timeInfo = this.deps.getTimeInfo(time);
    const hamletId = requireActiveHamletId();
    const accountKey = accountKeyOf({ accountBuildingId: buildingId });
    const policy = await this.deps.getCompanyAidPolicy();
    // The terms of a loan are stamped on it when it is granted.
    const loan = form === 'loan' ? { interestRate: policy.loanInterestRate, interestStartsAfterMonths: policy.interestStartsAfterMonths } : null;
    // The shares a contribution buys, at the price of a share now; a participation buys none.
    let shares = null;
    if (form === 'shareholder') {
      const { sharePrice } = (await this.describe()).find((candidate) => candidate.buildingId === buildingId);
      shares = sharesBoughtBy({ amount: centimes / 100, price: sharePrice });
    } else if (form === 'participation') shares = 0;
    const stamp = `${timeInfo.month} ${timeInfo.year}`;
    const line = (type, label, side) => ({
      turn: time,
      type,
      amount: centimes / 100,
      description: `${label} ${company.name} - ${stamp}`,
      // One contribution a turn and form: the turn is in the key, so a second one on another day is a new line.
      businessKey: `${type}:${hamletId}:${accountKey}:contribution:${time}`,
      buildingInstanceId: buildingId,
      ...(side === 'company' ? { accountBuildingId: buildingId, counterpartyBuildingId: null } : { accountBuildingId: null, counterpartyBuildingId: buildingId }),
      ...(loan ? { loan } : {}),
      ...(shares !== null ? { shares } : {}),
    });
    for (const written of [line(kind.paid, kind.paidLabel, 'city'), line(kind.received, kind.receivedLabel, 'company')]) {
      const result = await this.deps.recordLedgerEntry(written);
      if (!result.recorded) throw new Error(`[company-aid] the ${written.type} line "${written.description}" was not recorded: ${result.reason}`);
    }
    return { amount: centimes / 100, form };
  }
}
