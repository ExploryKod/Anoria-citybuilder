import { getPartnerImportCapacity } from '../../domain/policies/PartnerTradePolicy.js';
import {
  mergeProductTradeToggles,
  getTradeToggleStatusLabel,
  getPlayerImportCap,
  getMaxImportUpTo,
} from '../../domain/policies/PlayerTradeTogglePolicy.js';

/**
 * @param {object} params
 * @param {Array<object>} params.productConfig
 * @param {object} params.stats
 * @param {Record<string, number>} params.stockByProductId
 * @param {Array<object>} [params.partners]
 */
export function buildTradeGoodsView({ productConfig, stats, stockByProductId, partners = [] }) {
  const yearlyExports = stats?.yearlyExports ?? {};
  const yearlyImports = stats?.yearlyImports ?? {};

  return (productConfig ?? []).map((product) => {
    const exportCap = product.sellingMax ?? 0;
    const importCap = product.buyingMax ?? 0;
    const yearlyExport = yearlyExports[product.id] ?? 0;
    const yearlyImport = yearlyImports[product.id] ?? 0;
    const partnerImportCapacity = getPartnerImportCapacity(product.id, partners);
    const maxImportUpTo = getMaxImportUpTo(product, partners);
    const toggles = mergeProductTradeToggles(product, partnerImportCapacity);
    const status = getTradeToggleStatusLabel(product, exportCap, maxImportUpTo);
    const effectiveImportCap = getPlayerImportCap(product, partners);

    return {
      id: product.id,
      name: product.name,
      stock: stockByProductId[product.id] ?? 0,
      yearlyExport,
      yearlyImport,
      exportCap,
      importCap,
      partnerImportCapacity,
      maxImportUpTo,
      effectiveImportCap,
      status,
      ...toggles,
      canExport: exportCap > 0,
      canImport: maxImportUpTo > 0,
    };
  });
}
