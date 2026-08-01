export { CommerceSimulationService } from '../../contexts/commerce/application/services/CommerceSimulationService.js';

/**
 * ACL — Commerce bounded context entry points.
 */
export {
  createCommerceContext,
  getOrCreateCommerceContext,
  resetCommerceContextForTests,
  setCommercePartnerContractFinishedHandler,
} from '../../composition/createCommerceContext.js';

export {
  getPriceStatus,
} from '../../contexts/commerce/domain/policies/PriceStatusPolicy.js';

export {
  hasActiveContract,
  isContractFinished,
  getContractStatus,
} from '../../contexts/commerce/domain/policies/PartnerContractPolicy.js';

export {
  canTradeWithPartner,
  getPartnerTradeLimit,
} from '../../contexts/commerce/domain/policies/PartnerTradePolicy.js';

export {
  canImportProduct,
  canExportProduct,
  isStockableProduct,
  getProductTradeConditions,
} from '../../contexts/commerce/domain/policies/ProductTradePolicy.js';

export {
  getProductStockKey,
  getProductDisplayName,
} from '../../contexts/commerce/domain/catalogs/ProductCatalog.js';

export {
  evaluateDefaultActivationConditions,
  evaluatePartnerActivationConditions,
} from '../../contexts/commerce/domain/policies/PartnerActivationPolicy.js';

export {
  createDefaultPartners,
  migrateStoredPartners,
} from '../../contexts/commerce/domain/catalogs/PartnerCatalog.js';

export { createDefaultProductConfig } from '../../contexts/commerce/domain/catalogs/ProductConfigCatalog.js';

export { LocalStorageCommerceRepository } from '../../contexts/commerce/infrastructure/persistence/LocalStorageCommerceRepository.js';

import { getOrCreateCommerceContext } from '../../composition/createCommerceContext.js';

function commerceRepository() {
  return getOrCreateCommerceContext().commerceRepository;
}

/** Commerce localStorage persistence — UI + simulation. */
export function saveCommerceConfig(goodsData) {
  return commerceRepository().saveConfig(goodsData);
}

export function loadCommerceConfig() {
  return commerceRepository().loadConfig();
}

export function loadOrSeedCommerceConfig() {
  return commerceRepository().loadOrSeedConfig();
}

export function getCommerceProductConfig(productId) {
  return commerceRepository().getProductConfig(productId);
}

export function saveCommerceStats(stats) {
  return commerceRepository().saveStats(stats);
}

export function loadCommerceStats() {
  return commerceRepository().loadStats();
}

export function updateCommerceProductStats(productId, productStats) {
  return commerceRepository().updateProductStats(productId, productStats);
}

export function resetCommerceYearlyStats() {
  return commerceRepository().resetYearlyStats();
}

export function loadCommercePartners() {
  return commerceRepository().loadPartners();
}

export function loadOrSeedCommercePartners() {
  return commerceRepository().loadOrSeedPartners();
}

export function saveCommercePartners(partnersData) {
  return commerceRepository().savePartners(partnersData);
}

export function clearCommercePersistence() {
  return getOrCreateCommerceContext().clear();
}
