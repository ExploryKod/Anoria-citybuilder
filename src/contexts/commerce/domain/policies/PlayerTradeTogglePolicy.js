import { getPartnerImportCapacity } from './PartnerTradePolicy.js';

/** @type {Record<string, { exportEnabled: boolean, importEnabled: boolean, exportFromThreshold: number, importUpTo: number, industryActive: boolean }>} */
const DEFAULT_TRADE_TOGGLES = Object.freeze({
  wood: Object.freeze({
    exportEnabled: true,
    importEnabled: false,
    exportFromThreshold: 0,
    importUpTo: 0,
    industryActive: true,
  }),
  furniture: Object.freeze({
    exportEnabled: true,
    importEnabled: false,
    exportFromThreshold: 0,
    importUpTo: 0,
    industryActive: true,
  }),
  figs: Object.freeze({
    exportEnabled: false,
    importEnabled: true,
    exportFromThreshold: 0,
    importUpTo: 10,
    industryActive: true,
  }),
});

/** @param {string} productId */
export function getDefaultTradeToggles(productId) {
  return DEFAULT_TRADE_TOGGLES[productId] ?? {
    exportEnabled: false,
    importEnabled: false,
    exportFromThreshold: 0,
    importUpTo: 0,
    industryActive: true,
  };
}

/**
 * @param {object} product
 * @param {number} [partnerImportCapacity]
 */
export function mergeProductTradeToggles(product, partnerImportCapacity = 0) {
  const defaults = getDefaultTradeToggles(product.id);
  const buyingMax = product.buyingMax ?? 0;
  const maxImportUpTo = getMaxImportUpTo(product, partnerImportCapacity);
  const defaultImportUpTo =
    defaults.importUpTo > 0 ? defaults.importUpTo : maxImportUpTo;

  return {
    exportEnabled: product.exportEnabled ?? defaults.exportEnabled,
    importEnabled: product.importEnabled ?? defaults.importEnabled,
    exportFromThreshold: product.exportFromThreshold ?? defaults.exportFromThreshold,
    importUpTo: product.importUpTo ?? defaultImportUpTo,
    industryActive: product.industryActive ?? defaults.industryActive,
  };
}

/**
 * Max units importable per year from partner routes (capped by city buyingMax if set).
 * @param {object|null} productConfig
 * @param {Array<object>} [partners]
 */
export function getMaxImportUpTo(productConfig, partners = []) {
  if (!productConfig) {
    return 0;
  }

  const buyingMax = productConfig.buyingMax ?? 0;
  const partnerCapacity = getPartnerImportCapacity(productConfig.id, partners);

  if (partnerCapacity === 0 && buyingMax === 0) {
    return 0;
  }
  if (buyingMax === 0) {
    return partnerCapacity;
  }
  if (partnerCapacity === 0) {
    return buyingMax;
  }
  return Math.min(buyingMax, partnerCapacity);
}

/** @param {object|null} productConfig @param {Array<object>} [partners] */
export function getPlayerImportCap(productConfig, partners = []) {
  if (!productConfig) {
    return 0;
  }

  const maxImportUpTo = getMaxImportUpTo(productConfig, partners);
  if (maxImportUpTo === 0) {
    return 0;
  }

  const partnerCapacity = getPartnerImportCapacity(productConfig.id, partners);
  const { importUpTo } = mergeProductTradeToggles(productConfig, partnerCapacity);
  return Math.min(maxImportUpTo, Math.max(0, importUpTo));
}

/**
 * @param {object} params
 * @param {'import'|'export'} params.operation
 * @param {object|null} params.productConfig
 * @param {number} [params.stock]
 * @param {Array<object>} [params.partners]
 */
export function canExecuteTrade({ operation, productConfig, stock = 0, partners = [] }) {
  if (!productConfig) {
    return false;
  }

  const toggles = mergeProductTradeToggles(
    productConfig,
    getPartnerImportCapacity(productConfig.id, partners)
  );

  if (operation === 'import') {
    return toggles.importEnabled && getPlayerImportCap(productConfig, partners) > 0;
  }

  if (operation === 'export') {
    return toggles.exportEnabled && stock > toggles.exportFromThreshold;
  }

  return false;
}

/**
 * @param {object} product
 * @param {number} exportCap
 * @param {number} maxImportUpTo
 */
export function getTradeToggleStatusLabel(product, exportCap, maxImportUpTo) {
  const toggles = mergeProductTradeToggles(product);
  const parts = [];

  if (exportCap > 0) {
    parts.push(toggles.exportEnabled ? 'Export ON' : 'Export OFF');
  }
  if (maxImportUpTo > 0) {
    parts.push(toggles.importEnabled ? 'Import ON' : 'Import OFF');
  }
  if (!toggles.industryActive) {
    parts.push('Industrie OFF');
  }
  if (exportCap > 0 && toggles.exportEnabled && toggles.exportFromThreshold > 0) {
    parts.push(`≥ ${toggles.exportFromThreshold}`);
  }
  if (maxImportUpTo > 0 && toggles.importEnabled && toggles.importUpTo < maxImportUpTo) {
    parts.push(`≤ ${toggles.importUpTo}`);
  }

  return parts.length > 0 ? parts.join(' · ') : '—';
}
