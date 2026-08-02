/** @param {object} tradeLine */
function isTradeLineQuotaExhausted(tradeLine) {
  return (tradeLine.currentYearly || 0) >= tradeLine.maxOccurrences;
}

/** @param {object} partner */
export function hasRemainingYearlyQuota(partner) {
  const hasImportQuota = partner.imports.some(
    (imp) => !isTradeLineQuotaExhausted(imp)
  );
  const hasExportQuota = partner.exports.some(
    (exp) => !isTradeLineQuotaExhausted(exp)
  );
  return hasImportQuota || hasExportQuota;
}

/** @param {object} partner */
export function isYearlyQuotaExhausted(partner) {
  if (!partner?.isActive) {
    return false;
  }

  const hasImports = partner.imports?.length > 0;
  const hasExports = partner.exports?.length > 0;

  if (!hasImports && !hasExports) {
    return false;
  }

  const allImportsExhausted = hasImports
    ? partner.imports.every(isTradeLineQuotaExhausted)
    : true;

  const allExportsExhausted = hasExports
    ? partner.exports.every(isTradeLineQuotaExhausted)
    : true;

  return allImportsExhausted && allExportsExhausted;
}

/** @deprecated Use hasRemainingYearlyQuota — kept for commerceOps exports */
export const hasActiveContract = hasRemainingYearlyQuota;

/** @deprecated Use isYearlyQuotaExhausted */
export const isContractFinished = isYearlyQuotaExhausted;

/** @param {object} partner */
export function getPartnerQuotaStatus(partner) {
  const exhaustedImports = partner.imports
    .filter(isTradeLineQuotaExhausted)
    .map((imp) => ({
      productId: imp.productId,
      productName: imp.productName,
      currentYearly: imp.currentYearly || 0,
      yearlyQuota: imp.maxOccurrences,
    }));

  const exhaustedExports = partner.exports
    .filter(isTradeLineQuotaExhausted)
    .map((exp) => ({
      productId: exp.productId,
      productName: exp.productName,
      currentYearly: exp.currentYearly || 0,
      yearlyQuota: exp.maxOccurrences,
    }));

  return {
    exhaustedImports,
    exhaustedExports,
    hasRemainingYearlyQuota: hasRemainingYearlyQuota(partner),
    isYearlyQuotaExhausted: isYearlyQuotaExhausted(partner),
  };
}

/** @deprecated Use getPartnerQuotaStatus */
export const getContractStatus = getPartnerQuotaStatus;
