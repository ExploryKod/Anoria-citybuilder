import { DexieCityTradeRepository } from '../contexts/geography/infrastructure/dexie/DexieCityTradeRepository.js';
import { RunMonthlyCityTradeCycle } from '../contexts/geography/application/workflows/RunMonthlyCityTradeCycle.js';
import { TRADE_CATALOG, getTradeCatalogEntry } from '../contexts/geography/domain/catalogs/TradeCatalog.js';
import { canOpenRelation } from '../contexts/geography/application/canOpenRelation.js';

/**
 * Composition root — geography / trade bounded context.
 *
 * @param {object} deps
 * @param {ReturnType<import('./createSupplyContext.js').createSupplyContext>} deps.supply
 * @param {ReturnType<import('./createAccountingContext.js').createAccountingContext>} deps.accounting
 */
export function createTradeContext({ supply, accounting }) {
  const cityTradeRepository = new DexieCityTradeRepository();

  const runMonthlyCityTradeCycle = new RunMonthlyCityTradeCycle({
    cityTradeRepository,
    supplyBuildingRepository: supply.supplyBuildingRepository,
    recordCommerceExportIncome: (params) =>
      accounting.recordCommerceExportIncome(params),
    recordMerchantSale: (params) => supply.recordMerchantSale(params),
    getCustomsRate: () => accounting.getCustomsRate(),
  });

  return {
    cityTradeRepository,

    async openRelation(cityId, { demandMultiplier, startMonth }) {
      await cityTradeRepository.saveRelation({
        cityId,
        status: 'active',
        demandMultiplier,
        satisfactionScore: 50,
        contractStartMonth: startMonth,
        contractEndMonth: null,
        lastOrderMonth: null,
      });
    },

    async getAllRelations() {
      return cityTradeRepository.getAllRelations();
    },

    async getRelation(cityId) {
      return cityTradeRepository.getRelation(cityId);
    },

    async runMonthlyCityTradeCycle(timeInfo) {
      return runMonthlyCityTradeCycle.execute(timeInfo);
    },

    /**
     * For each catalog city not yet in the DB, open the relation if
     * canOpenRelation passes. Safe to call every month — skips existing rows.
     * @param {{ monthIndex: number }} timeInfo
     */
    async checkAndOpenNewRelations({ monthIndex }) {
      for (const entry of TRADE_CATALOG) {
        const existing = await cityTradeRepository.getRelation(entry.cityId);
        if (existing) continue;
        const ok = await canOpenRelation(entry.cityId);
        if (!ok) continue;
        const mult = entry.wants[0]?.baseMultiplier ?? 1;
        await cityTradeRepository.saveRelation({
          cityId: entry.cityId,
          status: 'active',
          demandMultiplier: mult,
          satisfactionScore: 50,
          contractStartMonth: monthIndex,
          contractEndMonth: null,
          lastOrderMonth: null,
        });
      }
    },

    /**
     * Trade summary for one city — relation state + all historical sales.
     * @param {string} cityId
     * @returns {Promise<{ relation: object|null, entry: object|null, sales: object[] }>}
     */
    async getCityTradeInfo(cityId) {
      const [relation, sales] = await Promise.all([
        cityTradeRepository.getRelation(cityId),
        supply.getMerchantSalesForCity(cityId),
      ]);
      return { relation: relation ?? null, entry: getTradeCatalogEntry(cityId), sales };
    },
  };
}

/** @type {ReturnType<typeof createTradeContext> | null} */
let sharedTrade = null;

/**
 * @param {Parameters<typeof createTradeContext>[0]} deps
 */
export function getOrCreateTradeContext(deps) {
  if (!sharedTrade) {
    sharedTrade = createTradeContext(deps);
  }
  return sharedTrade;
}

/** @internal Tests only */
export function resetTradeContextForTests() {
  sharedTrade = null;
}
