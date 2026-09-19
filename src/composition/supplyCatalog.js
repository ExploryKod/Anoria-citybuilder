/**
 * Static Supply catalog facts for presentation (no getOrCreate). Live Supply
 * operations stay on supplyOps.js, composition-internal only.
 */
export { getResourceStockShape } from '../contexts/supply/domain/policies/ResourceRolePolicy.js';
export { getResourceCategoryPresentation } from '../contexts/supply/domain/catalogs/ResourceCategoryCatalog.js';
