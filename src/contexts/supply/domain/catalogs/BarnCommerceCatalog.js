/** Commerce products stored in Barn-001 (aligned with commerce ProductCatalog MVP). */
export const BARN_COMMERCE_PRODUCTS = Object.freeze(['wood', 'furniture', 'figs']);

/** Source of truth — units one barn worker can store (all goods combined). */
export const BARN_UNITS_PER_WORKER = 10;

/** Source of truth — absolute max goods in one barn (all denrées combined). */
export const BARN_MAX_TOTAL_CAPACITY = 60;

/** Factory field → commerce productId for monthly transfer. */
export const FACTORY_TO_BARN_TRANSFERS = Object.freeze([
  { productId: 'wood', factoryField: 'rawMaterials', factoryKey: 'wood' },
  { productId: 'furniture', factoryField: 'products', factoryKey: 'furniture' },
]);

/** Labels for commerce goods in barn UI. */
export const BARN_COMMERCE_PRODUCT_LABELS = Object.freeze({
  wood: 'Bois',
  furniture: 'Meubles',
  figs: 'Figues',
});

/**
 * Max workers a barn can use — derived from capacity rules.
 */
export function getBarnMaxWorkers() {
  return Math.floor(BARN_MAX_TOTAL_CAPACITY / BARN_UNITS_PER_WORKER);
}

/**
 * Storage capacity for a given worker count — derived from the two source rules.
 *
 * @param {number} workerCount
 */
export function getBarnCapacityForWorkerCount(workerCount) {
  const workers = Math.max(0, Math.floor(Number(workerCount) || 0));
  const effectiveWorkers = Math.min(workers, getBarnMaxWorkers());
  return Math.min(
    effectiveWorkers * BARN_UNITS_PER_WORKER,
    BARN_MAX_TOTAL_CAPACITY
  );
}

/**
 * @param {Record<string, number>|null|undefined} stocks
 */
export function createEmptyCommerceStocks(stocks = {}) {
  return {
    wood: stocks.wood ?? 0,
    furniture: stocks.furniture ?? 0,
    figs: stocks.figs ?? 0,
  };
}
