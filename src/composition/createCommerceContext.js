import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { LocalStorageCommerceRepository } from '../contexts/commerce/infrastructure/persistence/LocalStorageCommerceRepository.js';
import { CommerceSimulationService } from '../contexts/commerce/application/services/CommerceSimulationService.js';

/** @type {ReturnType<typeof createCommerceContext>|null} */
let sharedCommerce = null;

/**
 * @param {object} [deps]
 * @param {LocalStorageCommerceRepository} [deps.commerceRepository]
 * @param {(turn: number) => object} [deps.getTimeInfo]
 * @param {import('../supply/application/services/BarnStockOperations.js').BarnStockOperations} [deps.barnStockOperations]
 */
export function createCommerceContext(deps = {}) {
  const commerceRepository = deps.commerceRepository ?? new LocalStorageCommerceRepository();
  const accounting = getOrCreateAccountingContext();
  const getTimeInfo = deps.getTimeInfo ?? resolveGetTimeInfo();

  const simulation = new CommerceSimulationService({
    commerceRepository,
    recordImportExpense: (...args) => accounting.recordImportExpense(...args),
    recordExportIncome: (...args) => accounting.recordExportIncome(...args),
    getTimeInfo,
    barnStockOperations: deps.barnStockOperations ?? null,
    commerceHubStock: deps.commerceHubStock,
  });

  return {
    commerceRepository,
    simulation,
    clear() {
      commerceRepository.clear();
    },
  };
}

/** @param {object} [deps] */
export function getOrCreateCommerceContext(deps = {}) {
  if (!sharedCommerce) {
    sharedCommerce = createCommerceContext(deps);
  }
  return sharedCommerce;
}

/** @internal Tests only */
export function resetCommerceContextForTests() {
  sharedCommerce = null;
}
