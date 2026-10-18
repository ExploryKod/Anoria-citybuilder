import { accountKeyOf } from '../../domain/policies/AccountKeyPolicy.js';
import { assetMovementsOf, monthlyDepreciationOf, postedAssetsOf, postedStockOf, stockVariationOf } from '../../domain/policies/MonthClosingPolicy.js';
import { DEPRECIATION_YEARS } from '../../domain/catalogs/DepreciationCatalog.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/**
 * Application service — the closing of the month's accounts, once the month is settled. It writes the opérations diverses, the lines that move no money
 * but that the books need (see PcgJournalCatalog):
 *   - for each company, the variation of its stock: what the stock is worth now (at cost, the supply's valuation) less what the closings already posted;
 *   - for the owner's property company: the buildings new to it (a contribution of the city), the buildings that are gone (a disposal: the depreciation
 *     so far released, what they were still worth a loss), then the month's depreciation of the buildings it holds.
 * Each line is written once per account and month: the business key refuses a second one.
 */
export class CloseMonthAccounts {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ buildingId: string, accountKind: string | null, nature: 'merchandise' | 'production' }>>} deps.listStockAccounts the accounts that hold a stock,
   *   with what their stock is (goods bought and resold, or goods made)
   * @param {(buildingId: string, period: { year: number, monthIndex: number }) => Promise<Array<{ value: number }>>} deps.valueStock what the stock of a building is worth at cost
   * @param {() => Promise<{ ownerId: string, businessAccount: string, constructions: Array<{ buildingId: string, category: string | null, cost: number, builtKey: number, held: boolean }> } | null>} deps.getOwnerHoldings
   *   the owner's property company and every building the city paid for (but the roads), with its cost, the month it was built, its family
   *   (null when its type is unknown) and whether it still stands; null when no owner stands
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {{ time: number, deliveredTime: number }} params `deliveredTime`: a turn of the month being closed
   */
  async execute({ time, deliveredTime }) {
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    const entries = await this.deps.getJournalEntries();

    for (const { buildingId, accountKind, nature } of await this.deps.listStockAccounts()) {
      const items = await this.deps.valueStock(buildingId, { year: timeInfo.year, monthIndex: timeInfo.monthIndex });
      const live = items.reduce((sum, item) => sum + Math.round(item.value * 100), 0);
      const variation = stockVariationOf({ live, posted: postedStockOf(entries, buildingId, accountKind), nature });
      if (!variation) continue;
      await this.#record({
        turn: time,
        type: variation.type,
        amount: variation.amount,
        description: `[OD] Variation de stock - ${monthLabel}`,
        businessKey: `od_stock:${accountKeyOf({ accountBuildingId: buildingId, accountKind })}:${timeInfo.year}:${timeInfo.monthIndex}`,
        buildingInstanceId: buildingId,
        accountBuildingId: buildingId,
        accountKind,
      });
    }

    const holdings = await this.deps.getOwnerHoldings();
    if (!holdings) return;
    const closingKey = timeInfo.year * MONTHS_PER_YEAR + timeInfo.monthIndex;
    const ownerKey = accountKeyOf({ accountBuildingId: holdings.ownerId, accountKind: holdings.businessAccount });
    const posted = postedAssetsOf(entries, holdings.ownerId, holdings.businessAccount);
    const yearsOf = (construction) => {
      const years = DEPRECIATION_YEARS[construction.category];
      if (!(years > 0)) throw new Error(`[closing] the family "${construction.category}" (building ${construction.buildingId}) declares no life in DEPRECIATION_YEARS: it cannot be depreciated`);
      return years;
    };
    // A building the books carry that is gone must say what it was: its life is the one of its family.
    for (const construction of holdings.constructions) {
      if (!construction.held && (posted.get(construction.buildingId) ?? 0) > 0 && construction.category === null) {
        throw new Error(`[closing] the building ${construction.buildingId} left the owner's books but its construction line does not say its type: its disposal cannot be written`);
      }
    }
    const eligible = holdings.constructions.filter((construction) => construction.category !== null).map((construction) => ({ ...construction, years: yearsOf(construction) }));

    // The buildings that came and went since the last closing: a contribution of the city, or a disposal (the depreciation so far released, the rest a loss).
    for (const movement of assetMovementsOf({ closingKey, constructions: eligible, posted }, MONTHS_PER_YEAR)) {
      const common = { turn: time, buildingInstanceId: movement.buildingId, accountBuildingId: holdings.ownerId, accountKind: holdings.businessAccount };
      if (movement.kind === 'contribution') {
        await this.#record({ ...common, type: 'od_asset_contribution', amount: movement.cost / 100, description: `[OD] Construction apportée par la ville - ${monthLabel}`, businessKey: `od_asset_contribution:${ownerKey}:${movement.buildingId}` });
        continue;
      }
      if (movement.released > 0) {
        await this.#record({ ...common, type: 'od_asset_disposal_amortization', amount: movement.released / 100, description: `[OD] Bâtiment démoli : amortissement soldé - ${monthLabel}`, businessKey: `od_asset_disposal_amortization:${ownerKey}:${movement.buildingId}` });
      }
      if (movement.loss > 0) {
        await this.#record({ ...common, type: 'od_asset_disposal_loss', amount: movement.loss / 100, description: `[OD] Bâtiment démoli : valeur nette perdue - ${monthLabel}`, businessKey: `od_asset_disposal_loss:${ownerKey}:${movement.buildingId}` });
      }
    }

    const dotation = monthlyDepreciationOf({ closingKey, constructions: eligible.filter((construction) => construction.held) }, MONTHS_PER_YEAR);
    if (dotation > 0) {
      await this.#record({
        turn: time,
        type: 'od_depreciation',
        amount: dotation / 100,
        description: `[OD] Dotation aux amortissements - ${monthLabel}`,
        businessKey: `od_depreciation:${ownerKey}:${timeInfo.year}:${timeInfo.monthIndex}`,
        buildingInstanceId: holdings.ownerId,
        accountBuildingId: holdings.ownerId,
        accountKind: holdings.businessAccount,
      });
    }
  }

  /** A month already closed is not written again; any other refusal is a defect, not a skipped line. */
  async #record(line) {
    const result = await this.deps.recordLedgerEntry(line);
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[closing] the ${line.type} line "${line.description}" was not recorded: ${result.reason}`);
    }
  }
}
