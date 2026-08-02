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
    const trade = partner.buysFromUs?.find((line) => line.productId === productId);
    if (trade?.pricePerUnit != null) {
      return trade.pricePerUnit;
    }
  } else if (operation === 'import') {
    const trade = partner.sellsToUs?.find((line) => line.productId === productId);
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
  if (!partner?.isActive) {
    return false;
  }

  if (operation === 'export') {
    const trade = partner.buysFromUs?.find((line) => line.productId === productId);
    if (!trade) {
      return false;
    }
    if (!trade.months.includes(currentMonthIndex)) {
      return false;
    }
    if ((trade.currentYearly || 0) >= trade.yearlyQuota) {
      return false;
    }
    return true;
  }

  if (operation === 'import') {
    const trade = partner.sellsToUs?.find((line) => line.productId === productId);
    if (!trade) {
      return false;
    }
    if (!trade.months.includes(currentMonthIndex)) {
      return false;
    }
    if ((trade.currentYearly || 0) >= trade.yearlyQuota) {
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
    const trade = partner.buysFromUs?.find((line) => line.productId === productId);
    if (trade) {
      return {
        maxPerTurn: trade.maxPerTurn ?? 1,
        yearlyQuota: trade.yearlyQuota,
        currentYearly: trade.currentYearly || 0,
        pricePerUnit: getPartnerTradePrice(partner, productId, 'export'),
      };
    }
  } else if (operation === 'import') {
    const trade = partner.sellsToUs?.find((line) => line.productId === productId);
    if (trade) {
      return {
        maxPerTurn: 1,
        yearlyQuota: trade.yearlyQuota,
        currentYearly: trade.currentYearly || 0,
        pricePerUnit: getPartnerTradePrice(partner, productId, 'import'),
      };
    }
  }

  return null;
}

/**
 * Cumulative yearly import capacity across all partners selling a product to us.
 * @param {string} productId
 * @param {Array<object>} partners
 */
export function getPartnerImportCapacity(productId, partners) {
  if (!Array.isArray(partners)) {
    return 0;
  }

  return partners.reduce((total, partner) => {
    const tradeLine = partner.sellsToUs?.find((line) => line.productId === productId);
    return total + (tradeLine?.yearlyQuota ?? 0);
  }, 0);
}
