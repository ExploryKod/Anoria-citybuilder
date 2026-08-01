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
