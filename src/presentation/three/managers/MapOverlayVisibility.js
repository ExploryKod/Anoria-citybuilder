const STORAGE_KEY = 'anoria.productionIconsVisible';

/** Status sprite names gated by the Production map filter (supply chain + employment). */
export const PRODUCTION_STATUS_SPRITE_NAMES = Object.freeze([
  'isBuying',
  'isBuying-bg',
  'isCollecting',
  'isCollecting-bg',
  'grow-food',
  'grow-food-bg',
  'harvest',
  'harvest-bg',
  'sell-food',
  'sell-food-bg',
  'sold-to-windmill',
  'sold-to-windmill-bg',
  'no-food',
  'no-food-bg',
  'no-work',
  'no-work-bg',
]);

/**
 * Presentation-only visibility for supply-chain status icons on the 3D map.
 * Domain BCs stay unaware — scene ANDs this flag into setStatusSprite visible.
 */
export class MapOverlayVisibility {
  constructor() {
    this.productionIconsVisible = readStoredProductionIconsVisible();
    /** @type {((visible: boolean) => void) | null} */
    this.onProductionIconsChange = null;
  }

  isProductionIconsVisible() {
    return this.productionIconsVisible;
  }

  /** @param {boolean} visible */
  setProductionIconsVisible(visible) {
    const next = !!visible;
    if (next === this.productionIconsVisible) {
      return;
    }
    this.productionIconsVisible = next;
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
    this.onProductionIconsChange?.(next);
  }
}

/**
 * @returns {boolean} default true (icons on)
 */
export function readStoredProductionIconsVisible() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}
