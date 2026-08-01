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
    if (trade.currentOccurrences >= trade.maxOccurrences) {
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
    if (trade.currentOccurrences >= trade.maxOccurrences) {
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
        maxOccurrences: trade.maxOccurrences,
        currentOccurrences: trade.currentOccurrences || 0,
      };
    }
  } else if (operation === 'import') {
    const trade = partner.exports.find((exp) => exp.productId === productId);
    if (trade) {
      return {
        maxPerTurn: 1,
        maxOccurrences: trade.maxOccurrences,
        currentOccurrences: trade.currentOccurrences || 0,
      };
    }
  }

  return null;
}
