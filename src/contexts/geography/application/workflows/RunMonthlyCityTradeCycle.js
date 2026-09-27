import { getTradeCatalogEntry } from '../../domain/catalogs/TradeCatalog.js';
import { getResourceBaseValue } from '../../../../contexts/supply/domain/catalogs/ResourceCategoryCatalog.js';

/**
 * Monthly city-trade cycle — for each active relation whose order rhythm is
 * due, consume deal goods from warehouses, credit customs revenue to treasury,
 * and record a merchant_sale traceability entry.
 *
 * One instance per game session; injected with ports so the geography context
 * stays decoupled from supply and accounting internals.
 */
export class RunMonthlyCityTradeCycle {
  /**
   * @param {{
   *   cityTradeRepository: import('../../infrastructure/dexie/DexieCityTradeRepository.js').DexieCityTradeRepository,
   *   supplyBuildingRepository: { findByResourceRole: Function, saveStocks: Function },
   *   recordCommerceExportIncome: (params: { turn: number, amount: number, description: string, productId: string, partnerId: string }) => Promise<unknown>,
   *   recordMerchantSale: (params: object) => Promise<void>,
   *   getCustomsRate: () => number,
   * }} deps
   */
  constructor({ cityTradeRepository, supplyBuildingRepository, recordCommerceExportIncome, recordMerchantSale, getCustomsRate }) {
    this.repo = cityTradeRepository;
    this.supplyRepo = supplyBuildingRepository;
    this.recordIncome = recordCommerceExportIncome;
    this.recordMerchantSale = recordMerchantSale;
    this.getCustomsRate = getCustomsRate;
  }

  /**
   * @param {{ turn: number, monthIndex: number, year: number }} timeInfo
   */
  async execute(timeInfo) {
    const { turn, monthIndex, year } = timeInfo;
    const relations = await this.repo.getActiveRelations();
    if (relations.length === 0) return;

    const customsRate = this.getCustomsRate();
    const hubs = await this.supplyRepo.findByResourceRole('hub');

    for (const relation of relations) {
      const entry = getTradeCatalogEntry(relation.cityId);
      if (!entry) continue;

      // Contract expiry check
      if (monthIndex >= relation.contractEndMonth) {
        const renewed = relation.satisfactionScore >= entry.relation.renewalThreshold;
        if (renewed) {
          relation.contractEndMonth = monthIndex + entry.relation.durationMonths;
          relation.satisfactionScore = Math.min(100, relation.satisfactionScore + 5);
        } else {
          relation.status = 'expired';
          await this.repo.saveRelation(relation);
          continue;
        }
      }

      // Voluntary break before term
      if (relation.satisfactionScore <= entry.relation.breakThreshold) {
        relation.status = 'suspended';
        await this.repo.saveRelation(relation);
        continue;
      }

      // Rhythm check: is this an order month?
      const lastOrder = relation.lastOrderMonth ?? (monthIndex - entry.trade.frequencyMonths);
      if (monthIndex - lastOrder < entry.trade.frequencyMonths) continue;

      let totalRevenue = 0;
      let anySold = false;

      for (const want of entry.wants) {
        const dealGood = want.merchantGood;
        if (!dealGood) continue;

        const baseValue = getResourceBaseValue(want.good);
        if (baseValue == null) continue;

        const available = this.#sumHubStock(hubs, dealGood);
        if (available <= 0) continue;

        const qty = Math.min(available, entry.trade.quantityPerOrder);
        if (qty <= 0) continue;

        // Deduct from hubs (oldest stock first, proportional across hubs)
        await this.#deductFromHubs(hubs, dealGood, qty);

        const grossRevenue = qty * baseValue * relation.demandMultiplier;
        const netRevenue = Math.round(grossRevenue * (1 - customsRate));
        const customsCollected = Math.round(grossRevenue * customsRate);
        totalRevenue += netRevenue + customsCollected;

        await this.recordIncome({
          turn,
          amount: netRevenue + customsCollected,
          description: `Export ${want.good} → ${relation.cityId} (${qty} unités, douane ${Math.round(customsRate * 100)}%)`,
          productId: want.good,
          partnerId: relation.cityId,
        });

        await this.recordMerchantSale({
          turn,
          monthIndex,
          year,
          cityId: relation.cityId,
          good: want.good,
          dealGood,
          quantity: qty,
          unitPrice: baseValue * relation.demandMultiplier,
          grossRevenue,
          netRevenue,
          customsCollected,
          customsRate,
        });

        anySold = true;
      }

      // Satisfaction: +2 if sold something, -5 if order month but nothing available
      relation.satisfactionScore = Math.max(0, Math.min(100,
        relation.satisfactionScore + (anySold ? 2 : -5)
      ));
      relation.demandMultiplier = entry.wants[0]?.baseMultiplier ?? 1;
      relation.lastOrderMonth = monthIndex;
      await this.repo.saveRelation(relation);
    }
  }

  /** Sum a deal good across all hub stocks. */
  #sumHubStock(hubs, good) {
    return hubs.reduce((sum, hub) => sum + Math.max(0, Number(hub.stocks?.[good]) || 0), 0);
  }

  /** Deduct `qty` units of `good` from hubs, largest stock first. */
  async #deductFromHubs(hubs, good, qty) {
    const sorted = [...hubs].sort((a, b) => (b.stocks?.[good] ?? 0) - (a.stocks?.[good] ?? 0));
    let remaining = qty;
    for (const hub of sorted) {
      if (remaining <= 0) break;
      const available = Math.max(0, Number(hub.stocks?.[good]) || 0);
      if (available <= 0) continue;
      const taken = Math.min(available, remaining);
      const newStock = { ...hub.stocks, [good]: available - taken };
      await this.supplyRepo.saveStocks(hub.id, newStock);
      hub.stocks = newStock;
      remaining -= taken;
    }
  }
}
