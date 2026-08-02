const MONTH_NAMES = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

/**
 * @param {number[]} monthIndexes
 */
function formatTradeMonths(monthIndexes) {
  return monthIndexes.map((month) => MONTH_NAMES[month] ?? month).join(', ');
}

/**
 * @param {object} tradeLine
 * @param {'export'|'import'} direction
 * @param {object} globalLimits
 * @param {boolean} hasCommercializableWindmills
 */
function mapTradeLine(tradeLine, direction, globalLimits, hasCommercializableWindmills) {
  const globalUsed =
    direction === 'export'
      ? globalLimits.yearlyExports[tradeLine.productId] || 0
      : globalLimits.yearlyImports[tradeLine.productId] || 0;
  const globalCap =
    direction === 'export'
      ? globalLimits.sellingMax[tradeLine.productId] || 0
      : globalLimits.buyingMax[tradeLine.productId] || 0;
  const yearlyQuotaReached = (tradeLine.currentYearly || 0) >= tradeLine.maxOccurrences;
  const globalLimitReached = globalCap > 0 && globalUsed >= globalCap;
  const isUnavailable =
    yearlyQuotaReached || globalLimitReached || !hasCommercializableWindmills;

  let statusClass = 'active';
  let statusText = 'Route active';
  if (yearlyQuotaReached) {
    statusClass = 'quota-reached';
    statusText = 'Quota annuel atteint';
  } else if (globalLimitReached) {
    statusClass = 'limit-reached';
    statusText = 'Plafond ville atteint';
  } else if (!hasCommercializableWindmills) {
    statusClass = 'no-windmill';
    statusText = 'Aucun moulin commercial';
  }

  return {
    productId: tradeLine.productId,
    productName: tradeLine.productName,
    monthsText: formatTradeMonths(tradeLine.months),
    maxPerTurn: tradeLine.maxPerTurn ?? 1,
    pricePerUnit: tradeLine.pricePerUnit ?? 0,
    yearlyQuota: tradeLine.maxOccurrences,
    currentYearly: tradeLine.currentYearly || 0,
    globalUsed,
    globalCap,
    isUnavailable,
    statusClass,
    statusText,
  };
}

/**
 * @param {object} params
 * @param {Array<object>} params.partners
 * @param {object} params.stats
 * @param {Array<object>} params.productConfig
 * @param {boolean} params.hasCommercializableWindmills
 * @param {Record<string, { canActivate: boolean, unmetConditions: string[] }>} params.activationByPartnerId
 */
export function buildTradePartnersView({
  partners,
  stats,
  productConfig,
  hasCommercializableWindmills,
  activationByPartnerId,
}) {
  const sellingMax = Object.fromEntries(
    (productConfig || []).map((product) => [product.id, product.sellingMax || 0])
  );
  const buyingMax = Object.fromEntries(
    (productConfig || []).map((product) => [product.id, product.buyingMax || 0])
  );
  const globalLimits = {
    yearlyExports: stats?.yearlyExports || {},
    yearlyImports: stats?.yearlyImports || {},
    sellingMax,
    buyingMax,
  };

  return partners.map((partner) => {
    const activation = activationByPartnerId[partner.id] || {
      canActivate: false,
      unmetConditions: [],
    };

    return {
      id: partner.id,
      name: partner.name,
      description: partner.description,
      isActive: Boolean(partner.isActive),
      canActivate: activation.canActivate,
      unmetConditions: activation.unmetConditions,
      buysFromUs: partner.imports.map((trade) =>
        mapTradeLine(trade, 'export', globalLimits, hasCommercializableWindmills)
      ),
      sellsToUs: partner.exports.map((trade) =>
        mapTradeLine(trade, 'import', globalLimits, hasCommercializableWindmills)
      ),
    };
  });
}
