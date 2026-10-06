import { splitVatIncluded } from '../../domain/policies/VatIncludedPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getResourceCategoryPresentation } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

/**
 * Application service — a delivery of goods to houses is paid when it is delivered. Each house and good is three lines:
 * the house pays the final price on its personal account (consumer_purchase), the seller receives it without the VAT
 * (producer_revenue), and the city receives the VAT (vat). The business key is the delivery's turn, the seller, the house
 * and the good: a delivery is written once.
 */
export class RecordConsumerPurchases {
  /**
   * @param {object} deps
   * @param {() => Promise<Record<string, number>>} deps.getVatRates the hamlet's VAT rate per good, in percent
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {object} params
   * @param {number} params.turn the delivery's turn
   * @param {{ month?: string, year: number }} params.timeInfo
   * @param {string} params.distributorId
   * @param {string} params.distributorType
   * @param {Array<{ houseId: string, category: string, units: number, unitPrice: number }>} params.purchases
   */
  async execute({ turn, timeInfo, distributorId, distributorType, purchases }) {
    const hamletId = requireActiveHamletId();
    const ratesPercent = await this.deps.getVatRates();
    const sellerName = getBuildingDefinition(distributorType)?.displayName;
    if (!sellerName) throw new Error(`[purchase] "${distributorType}" has no catalog name for its journal lines`);

    for (const purchase of purchases) {
      if (purchase.units <= 0) continue;
      const label = getResourceCategoryPresentation(purchase.category).label;
      const { ttc, ht, vat } = splitVatIncluded({
        ttc: purchase.units * purchase.unitPrice,
        ratePercent: ratesPercent[purchase.category],
      });
      const key = `${turn}:${distributorId}:${purchase.houseId}:${purchase.category}:${hamletId}`;
      const common = { turn, businessKey: key };

      await this.#record({
        ...common,
        type: 'consumer_purchase',
        amount: ttc,
        description: `Achat ${label} (${purchase.units} unités) chez ${sellerName} - ${timeInfo.month ?? ''} ${timeInfo.year}`,
        buildingInstanceId: distributorId,
        accountBuildingId: purchase.houseId,
        accountKind: 'particulier',
        counterpartyBuildingId: distributorId,
      }, key);
      await this.#record({
        ...common,
        type: 'producer_revenue',
        amount: ht,
        description: `Ventes ${label} à une maison (${purchase.units} unités, HT) - ${sellerName}`,
        buildingInstanceId: distributorId,
        accountBuildingId: distributorId,
        accountKind: null,
        counterpartyBuildingId: purchase.houseId,
      }, key);
      await this.#record({
        ...common,
        type: 'vat',
        amount: vat,
        description: `TVA sur ${label} vendu par ${sellerName}`,
        buildingInstanceId: null,
        accountBuildingId: null,
        accountKind: null,
        counterpartyBuildingId: null,
      }, key);
    }
  }

  /**
   * A line of zero is not written; a line the journal refuses for any other reason is a defect.
   * @param {object} line
   * @param {string} key
   */
  async #record(line, key) {
    if (line.amount <= 0) return;
    const result = await this.deps.recordLedgerEntry(line);
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[purchase] the ${line.type} line of ${key} was not recorded: ${result.reason}`);
    }
  }
}
