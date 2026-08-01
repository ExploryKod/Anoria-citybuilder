export const STOCKABLE_PRODUCTS = Object.freeze([
  'wheat',
  'carrot',
  'cabbage',
  'wood',
  'dattes',
]);

export const ALL_COMMERCE_PRODUCTS = Object.freeze([
  'wheat',
  'carrot',
  'cabbage',
  'wood',
  'dattes',
]);

export const PRODUCT_STOCK_KEYS = Object.freeze({
  wheat: 'wheat',
  carrot: 'carrot',
  cabbage: 'cabbage',
  wood: 'wood',
  dattes: 'dattes',
});

export const PRODUCT_DISPLAY_NAMES = Object.freeze({
  wheat: 'Blé',
  carrot: 'Carotte',
  cabbage: 'Chou',
  wood: 'Bois',
  dattes: 'Dattes',
});

const DEFAULT_CONDITIONS = Object.freeze({
  import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
  export: Object.freeze({ requiresStock: true, requiresWindmill: false }),
});

export const PRODUCT_TRADE_CONDITIONS = Object.freeze({
  wheat: {
    import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
    export: Object.freeze({ requiresStock: true, requiresWindmill: true }),
  },
  carrot: {
    import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
    export: Object.freeze({ requiresStock: true, requiresWindmill: true }),
  },
  cabbage: {
    import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
    export: Object.freeze({ requiresStock: true, requiresWindmill: true }),
  },
  wood: {
    import: Object.freeze({ requiresStock: false, requiresWindmill: true }),
    export: Object.freeze({ requiresStock: false, requiresWindmill: false }),
  },
  dattes: {
    import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
    export: Object.freeze({ requiresStock: true, requiresWindmill: true }),
  },
});

/** @param {string} productId */
export function isStockableProduct(productId) {
  return STOCKABLE_PRODUCTS.includes(productId);
}

/** @param {string} productId */
export function getProductStockKey(productId) {
  return PRODUCT_STOCK_KEYS[productId] ?? null;
}

/** @param {string} productId */
export function getProductDisplayName(productId) {
  return PRODUCT_DISPLAY_NAMES[productId] || productId;
}

/** @param {string} productId @param {'import'|'export'} operation */
export function getProductTradeConditions(productId, operation) {
  return PRODUCT_TRADE_CONDITIONS[productId]?.[operation] || DEFAULT_CONDITIONS[operation];
}
