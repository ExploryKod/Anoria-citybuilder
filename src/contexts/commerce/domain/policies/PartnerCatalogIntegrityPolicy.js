import { ALL_COMMERCE_PRODUCTS } from '../catalogs/ProductCatalog.js';

export const MVP_PARTNER_IDS = Object.freeze(['olivea', 'silvania']);

/**
 * @param {object} partner
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePartnerTradeLines(partner) {
  const errors = [];
  const buyIds = (partner.buysFromUs ?? []).map((line) => line.productId);
  const sellIds = (partner.sellsToUs ?? []).map((line) => line.productId);
  const buySet = new Set(buyIds);
  const sellSet = new Set(sellIds);

  for (const productId of buySet) {
    if (sellSet.has(productId)) {
      errors.push(
        `${partner.id}: "${productId}" cannot be both bought and sold by the same partner`
      );
    }
  }

  for (const productId of [...buySet, ...sellSet]) {
    if (!ALL_COMMERCE_PRODUCTS.includes(productId)) {
      errors.push(`${partner.id}: unknown commerce product "${productId}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {Array<object>} partners
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePartnerCatalog(partners) {
  const errors = [];

  if (!Array.isArray(partners)) {
    return { valid: false, errors: ['partners must be an array'] };
  }

  if (partners.length !== MVP_PARTNER_IDS.length) {
    errors.push(`expected ${MVP_PARTNER_IDS.length} partners, got ${partners.length}`);
  }

  const ids = partners.map((partner) => partner.id);
  for (const expectedId of MVP_PARTNER_IDS) {
    if (!ids.includes(expectedId)) {
      errors.push(`missing partner "${expectedId}"`);
    }
  }

  for (const partner of partners) {
    const lineResult = validatePartnerTradeLines(partner);
    errors.push(...lineResult.errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {Array<object>} partners
 * @returns {boolean}
 */
export function isMvpPartnerCatalog(partners) {
  if (!Array.isArray(partners) || partners.length !== MVP_PARTNER_IDS.length) {
    return false;
  }
  const ids = new Set(partners.map((partner) => partner.id));
  return MVP_PARTNER_IDS.every((id) => ids.has(id));
}
