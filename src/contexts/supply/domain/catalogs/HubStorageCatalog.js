export const HUB_KIND = Object.freeze({
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
});

export const WINDMILL_HUB_PRODUCT_LABELS = Object.freeze({
  wheat: 'Blé',
  cabbage: 'Chou',
  carrot: 'Carotte',
  dattes: 'Dattes',
  wood: 'Bois',
});

/**
 * @param {'windmill'} hubKind
 * @returns {ReadonlyArray<string>}
 */
export function listHubProducts(hubKind) {
  if (hubKind === HUB_KIND.WINDMILL) {
    return WINDMILL_HUB_PRODUCTS;
  }
  return [];
}

/**
 * @param {'windmill'} hubKind
 * @param {string} productId
 */
export function getHubProductLabel(hubKind, productId) {
  return WINDMILL_HUB_PRODUCT_LABELS[productId] ?? productId;
}

/**
 * @param {string} productId
 */
export function getHubProductEmoji(productId) {
  return HUB_PRODUCT_EMOJI[productId] ?? '📦';
}
