import { BARN_COMMERCE_PRODUCTS, BARN_COMMERCE_PRODUCT_LABELS } from './BarnCommerceCatalog.js';

export const HUB_KIND = Object.freeze({
  BARN: 'barn',
  WINDMILL: 'windmill',
});

/** Windmill granary lines shown in the info hub panel. */
export const WINDMILL_HUB_PRODUCTS = Object.freeze([
  'wheat',
  'cabbage',
  'carrot',
  'dattes',
  'wood',
]);

export const HUB_PRODUCT_EMOJI = Object.freeze({
  wheat: '🌾',
  cabbage: '🥬',
  carrot: '🥕',
  dattes: '🌴',
  wood: '🪵',
  furniture: '🪑',
  figs: '🍇',
});

export const WINDMILL_HUB_PRODUCT_LABELS = Object.freeze({
  wheat: 'Blé',
  cabbage: 'Chou',
  carrot: 'Carotte',
  dattes: 'Dattes',
  wood: 'Bois',
});

/**
 * @param {'barn'|'windmill'} hubKind
 * @returns {ReadonlyArray<string>}
 */
export function listHubProducts(hubKind) {
  if (hubKind === HUB_KIND.BARN) {
    return BARN_COMMERCE_PRODUCTS;
  }
  return WINDMILL_HUB_PRODUCTS;
}

/**
 * @param {'barn'|'windmill'} hubKind
 * @param {string} productId
 */
export function getHubProductLabel(hubKind, productId) {
  if (hubKind === HUB_KIND.BARN) {
    return BARN_COMMERCE_PRODUCT_LABELS[productId] ?? productId;
  }
  return WINDMILL_HUB_PRODUCT_LABELS[productId] ?? productId;
}

/**
 * @param {string} productId
 */
export function getHubProductEmoji(productId) {
  return HUB_PRODUCT_EMOJI[productId] ?? '📦';
}
