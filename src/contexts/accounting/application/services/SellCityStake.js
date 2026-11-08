import { accountKeyOf } from '../../domain/policies/AccountKeyPolicy.js';
import { aidEntriesOf, companyAidOf, sharesHeldIn } from '../../domain/policies/CompanyAidLedgerPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Application service — the city sells shares it holds in a company to a private holder, the property company (the only one with money of its own besides the companies):
 * it pays what the shares cost the city (their average price), the city's holding in the company shrinks by as much, and the dividends of the shares go to their new holder
 * (SettleCompanyAid). A sale the buyer cannot pay, or of shares the city does not hold, is refused with its reason.
 */
export class SellCityStake {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {() => Promise<{ id: string, businessAccount: string } | null>} deps.getBuyer the property company, null when none stands
   * @param {(buildingId: string, accountKind: string) => Promise<number>} deps.cashOf a business account's money, in euros
   * @param {(buildingId: string) => Promise<boolean>} deps.isCompany
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {{ buildingId: string, shares: number, time: number }} params
   * @returns {Promise<{ sold: true, shares: number, amount: number } | { sold: false, reason: 'no_buyer' | 'buyer_insufficient_funds' | 'not_enough_shares', amount?: number }>} euros
   */
  async execute({ buildingId, shares, time }) {
    if (!Number.isFinite(shares) || !(shares > 0)) throw new Error(`[stake] the shares sold must be more than 0, got ${shares}`);
    if (!(await this.deps.isCompany(buildingId))) throw new Error(`[stake] building ${buildingId} is not a company: it has no shares`);
    const entries = aidEntriesOf(await this.deps.getJournalEntries());
    const aid = companyAidOf(entries, buildingId);
    const held = sharesHeldIn(entries, buildingId);
    if (shares > held.city + 1e-9) return { sold: false, reason: 'not_enough_shares' };
    const buyer = await this.deps.getBuyer();
    if (!buyer) return { sold: false, reason: 'no_buyer' };
    // At what they cost the city: its capital as a shareholder over the shares it bought, so a sale moves no profit or loss into the books.
    const centimes = Math.round((aid.shareholderCapital / aid.shareholderShares) * shares);
    if ((await this.deps.cashOf(buyer.id, buyer.businessAccount)) * 100 < centimes) return { sold: false, reason: 'buyer_insufficient_funds', amount: centimes / 100 };

    const hamletId = requireActiveHamletId();
    const common = {
      turn: time,
      amount: centimes / 100,
      shares,
      description: `Parts cédées par la ville (${Math.round(shares * 100) / 100} parts)`,
      buildingInstanceId: buildingId,
      transactionId: `stake:${buildingId}:${time}`,
    };
    const key = (type) => `${type}:${hamletId}:${accountKeyOf({ accountBuildingId: buildingId })}:${time}`;
    for (const line of [
      { ...common, type: 'stake_sold', businessKey: key('stake_sold'), accountBuildingId: null, counterpartyBuildingId: buildingId },
      { ...common, type: 'stake_bought', businessKey: key('stake_bought'), accountBuildingId: buyer.id, accountKind: buyer.businessAccount, counterpartyBuildingId: buildingId },
    ]) {
      const result = await this.deps.recordLedgerEntry(line);
      if (!result.recorded) throw new Error(`[stake] the ${line.type} line was not recorded: ${result.reason}`);
    }
    return { sold: true, shares, amount: centimes / 100 };
  }
}
