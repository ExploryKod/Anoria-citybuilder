import { getDefaultTradePrice } from '../catalogs/ProductCatalog.js';

/**
 * @param {object|null} partner
 * @param {string} productId
 * @param {'import'|'export'} operation City perspective
 */
export function getPartnerTradePrice(partner, productId, operation) {
  if (!partner) {
    return getDefaultTradePrice(productId, operation);
  }

  if (operation === 'export') {
    const trade = partner.imports.find((imp) => imp.productId === productId);
    if (trade?.pricePerUnit != null) {
      return trade.pricePerUnit;
    }
  } else if (operation === 'import') {
    const trade = partner.exports.find((exp) => exp.productId === productId);
    if (trade?.pricePerUnit != null) {
      return trade.pricePerUnit;
    }
  }

  return getDefaultTradePrice(productId, operation);
}

/**
 * @param {object} params
 * @param {object|null} params.partner
 * @param {string} params.productId
 * @param {'import'|'export'} params.operation
 * @param {number} params.currentMonthIndex
 */
export function canTradeWithPartner({ partner, productId, operation, currentMonthIndex }) {
  if (!partner || !partner.isActive) {
    return false;
  }

  if (operation === 'export') {
    const trade = partner.imports.find((imp) => imp.productId === productId);
    if (!trade) {
      return false;
    }
    if (!trade.months.includes(currentMonthIndex)) {
      return false;
    }
    if ((trade.currentYearly || 0) >= trade.maxOccurrences) {
      return false;
    }
    return true;
  }

  if (operation === 'import') {
    const trade = partner.exports.find((exp) => exp.productId === productId);
    if (!trade) {
      return false;
    }
    if (!trade.months.includes(currentMonthIndex)) {
      return false;
    }
    if ((trade.currentYearly || 0) >= trade.maxOccurrences) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * @param {object|null} partner
 * @param {string} productId
 * @param {'import'|'export'} operation
 */
export function getPartnerTradeLimit(partner, productId, operation) {
  if (!partner) {
    return null;
  }

  if (operation === 'export') {
    const trade = partner.imports.find((imp) => imp.productId === productId);
    if (trade) {
      return {
        maxPerTurn: trade.maxPerTurn,
        yearlyQuota: trade.maxOccurrences,
        currentYearly: trade.currentYearly || 0,
        pricePerUnit: getPartnerTradePrice(partner, productId, 'export'),
      };
    }
  } else if (operation === 'import') {
    const trade = partner.exports.find((exp) => exp.productId === productId);
    if (trade) {
      return {
        maxPerTurn: 1,
        yearlyQuota: trade.maxOccurrences,
        currentYearly: trade.currentYearly || 0,
        pricePerUnit: getPartnerTradePrice(partner, productId, 'import'),
      };
    }
  }

  return null;
}
