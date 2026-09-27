import { DexieCityTradeRepository } from '../contexts/geography/infrastructure/dexie/DexieCityTradeRepository.js';
import { RunMonthlyCityTradeCycle } from '../contexts/geography/application/workflows/RunMonthlyCityTradeCycle.js';

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

    async openRelation(cityId, { demandMultiplier, startMonth, durationMonths }) {
      await cityTradeRepository.saveRelation({
        cityId,
        status: 'active',
        demandMultiplier,
        satisfactionScore: 50,
        contractStartMonth: startMonth,
        contractEndMonth: startMonth + durationMonths,
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
