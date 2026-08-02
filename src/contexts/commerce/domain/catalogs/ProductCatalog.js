export const STOCKABLE_PRODUCTS = Object.freeze(['wood', 'furniture', 'figs']);

export const ALL_COMMERCE_PRODUCTS = Object.freeze(['wood', 'furniture', 'figs']);

export const PRODUCT_STOCK_KEYS = Object.freeze({
  wood: 'wood',
  furniture: 'furniture',
  figs: 'figs',
});

export const PRODUCT_DISPLAY_NAMES = Object.freeze({
  wood: 'Bois brut',
  furniture: 'Meubles',
  figs: 'Figues',
});

/** Fixed partner trade prices (Caesar-style — set by trade city, not the player). */
export const DEFAULT_PRODUCT_PRICES = Object.freeze({
  wood: Object.freeze({ import: 20, export: 25 }),
  furniture: Object.freeze({ import: 35, export: 45 }),
  figs: Object.freeze({ import: 14, export: 0 }),
});

/**
 * @param {string} productId
 * @param {'import'|'export'} operation City perspective (import = buy, export = sell)
 */
export function getDefaultTradePrice(productId, operation) {
  const prices = DEFAULT_PRODUCT_PRICES[productId];
  if (!prices) {
    return null;
  }
  return operation === 'import' ? prices.import : prices.export;
}

const DEFAULT_CONDITIONS = Object.freeze({
  import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
  export: Object.freeze({ requiresStock: true, requiresWindmill: false }),
});

export const PRODUCT_TRADE_CONDITIONS = Object.freeze({
  wood: {
    import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
    export: Object.freeze({ requiresStock: true, requiresWindmill: false }),
  },
  furniture: {
    import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
    export: Object.freeze({ requiresStock: true, requiresWindmill: false }),
  },
  figs: {
    import: Object.freeze({ requiresStock: false, requiresWindmill: false }),
    export: Object.freeze({ requiresStock: false, requiresWindmill: false }),
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
