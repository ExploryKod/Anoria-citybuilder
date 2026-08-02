import { mergeProductTradeToggles } from '../policies/PlayerTradeTogglePolicy.js';

/** Default yearly import/export caps per product (city-wide). */
export function createDefaultProductConfig() {
  return [
    {
      id: 'wood',
      name: 'Bois brut',
      sellingMax: 25,
      buyingMax: 0,
      exportEnabled: true,
      importEnabled: false,
      exportFromThreshold: 0,
      importUpTo: 0,
      industryActive: true,
    },
    {
      id: 'furniture',
      name: 'Meubles',
      sellingMax: 15,
      buyingMax: 0,
      exportEnabled: true,
      importEnabled: false,
      exportFromThreshold: 0,
      importUpTo: 0,
      industryActive: true,
    },
    {
      id: 'figs',
      name: 'Figues',
      sellingMax: 0,
      buyingMax: 10,
      exportEnabled: false,
      importEnabled: true,
      exportFromThreshold: 0,
      importUpTo: 10,
      industryActive: true,
    },
  ];
}

/**
 * @param {Array<object>|null} stored
 * @returns {Array<object>}
 */
export function normalizeStoredProductConfig(stored) {
  const defaults = createDefaultProductConfig();
  if (!Array.isArray(stored)) {
    return defaults;
  }

  const defaultIds = new Set(defaults.map((item) => item.id));
  const storedIds = new Set(stored.map((item) => item.id));
  const isMvpConfig =
    stored.length === defaults.length && defaults.every((item) => storedIds.has(item.id));

  if (!isMvpConfig) {
    return defaults;
  }

  return defaults.map((def) => {
    const existing = stored.find((item) => item.id === def.id);
    if (!existing) {
      return def;
    }

    return {
      id: def.id,
      name: def.name,
      sellingMax: existing.sellingMax ?? def.sellingMax,
      buyingMax: existing.buyingMax ?? def.buyingMax,
      ...mergeProductTradeToggles({ id: def.id, ...existing }),
    };
  });
}
