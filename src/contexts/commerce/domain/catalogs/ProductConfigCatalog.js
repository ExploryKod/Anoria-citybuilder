/** Default yearly import/export caps per product (city-wide). */
export function createDefaultProductConfig() {
  return [
    {
      id: 'wheat',
      name: 'Blé',
      sellingMax: 8,
      buyingMax: 8,
    },
    {
      id: 'carrot',
      name: 'Carotte',
      sellingMax: 8,
      buyingMax: 400,
    },
    {
      id: 'cabbage',
      name: 'Chou',
      sellingMax: 8,
      buyingMax: 300,
    },
    {
      id: 'wood',
      name: 'Bois',
      sellingMax: 8,
      buyingMax: 1000,
    },
    {
      id: 'dattes',
      name: 'Dattes',
      sellingMax: 0,
      buyingMax: 200,
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
    };
  });
}
