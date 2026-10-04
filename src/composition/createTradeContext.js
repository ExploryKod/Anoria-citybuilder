import { DexieCityTradeRepository } from '../contexts/geography/infrastructure/dexie/DexieCityTradeRepository.js';
import { RunMonthlyCityTradeCycle } from '../contexts/geography/application/workflows/RunMonthlyCityTradeCycle.js';
import { TRADE_CATALOG, SATISFACTION_START, getTradeCatalogEntry } from '../shared/trade-catalog/TradeCatalog.js';
import { canOpenRelation } from '../contexts/geography/application/canOpenRelation.js';
import { getCategoriesForRole, getTotalKeyForRole } from '../contexts/supply/domain/policies/ResourceRolePolicy.js';
import { takeCategoryAmount } from '../contexts/supply/domain/value-objects/ResourceStock.js';

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
    hubServing: supply.hubServing,
    // A hub's `goods` field is a shared total across every deal good it stores (see
    // buildingEconomy.js's TradeWarehouse) — keeping the category taken and that total in step is
    // the same supply-domain rule CollectResourceToHub already follows (ResourceStock.js);
    // geography gets it as a capability instead of importing across the bounded context.
    takeHubStock: (hub, category, amount) =>
      takeCategoryAmount(hub.stocks, category, amount, getCategoriesForRole(hub.type, 'hub'), getTotalKeyForRole(hub.type, 'hub')),
    recordCommerceExportIncome: (params) =>
      accounting.recordCommerceExportIncome(params),
    recordMerchantSale: (params) => supply.recordMerchantSale(params),
    getCustomsRate: () => accounting.getCustomsRate(),
    random: () => Math.random(),
    // Where a sale's range is centred. No game event moves it yet, so every sale is centred on 0 (no
    // favour, no hurt); events, the relation's state and the merchant's experience plug in here.
    saleBias: () => 0,
  });

  return {
    cityTradeRepository,

    async openRelation(cityId, { startMonth }) {
      await cityTradeRepository.saveRelation({
        cityId,
        status: 'active',
        satisfactionScore: SATISFACTION_START,
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
        await cityTradeRepository.saveRelation({
          cityId: entry.cityId,
          status: 'active',
          satisfactionScore: SATISFACTION_START,
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
