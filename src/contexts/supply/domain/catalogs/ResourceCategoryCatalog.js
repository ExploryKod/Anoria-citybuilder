/**
 * Declarative presentation facts for resource categories — icon + French
 * label + optional chart colors (`dark` = current stock, `pale` = free
 * room), pure data. This is the ONLY place a good gets a name or a color:
 * no other file may spell one out. Every category any building declares in its
 * `resourceRoles` (see buildingEconomy.js) should have an entry here so a
 * generic UI (resource cards, hub storage) can render it without a
 * per-category branch in code. `unit` is how one is counted (`{ one, many }`,
 * "1 panier", "12 paniers"). A category with no entry is shown as "…" with a
 * warning by presentation/dom/shell/CatalogVocabulary.js, never as a made-up name.
 */
const BASKET = Object.freeze({ one: 'panier', many: 'paniers' });
const unitOf = (one, many) => Object.freeze({ one, many });
export const RESOURCE_CATEGORY_PRESENTATION = Object.freeze({
  wheat: Object.freeze({ emoji: '🌾', label: 'Blé', unit: BASKET, colors: Object.freeze({ dark: '#F9A825', pale: '#FFF59D' }) }),
  cabbage: Object.freeze({ emoji: '🥬', label: 'Chou', unit: BASKET, colors: Object.freeze({ dark: '#388E3C', pale: '#A5D6A7' }) }),
  carrot: Object.freeze({ emoji: '🥕', label: 'Carotte', unit: BASKET, colors: Object.freeze({ dark: '#EF6C00', pale: '#FFCC80' }) }),
  fruit: Object.freeze({ emoji: '🍎', label: 'Fruits', unit: BASKET, colors: Object.freeze({ dark: '#C62828', pale: '#EF9A9A' }) }),
  game: Object.freeze({ emoji: '🦌', label: 'Gibier', unit: BASKET, colors: Object.freeze({ dark: '#8D5B45', pale: '#D7B8A8' }) }),
  dattes: Object.freeze({ emoji: '🌴', label: 'Dattes', unit: BASKET, colors: Object.freeze({ dark: '#795548', pale: '#D7CCC8' }) }),
  wood: Object.freeze({ emoji: '🪵', label: 'Bois', unit: unitOf('bûche', 'bûches'), colors: Object.freeze({ dark: '#6D4C2C', pale: '#D4BC8C' }) }),
  food: Object.freeze({ emoji: '🍽️', label: 'Nourriture', unit: BASKET }),
  goods: Object.freeze({ emoji: '📦', label: 'Biens', unit: unitOf('bien', 'biens') }),
  // Chart colors follow what the good is made of: walnut for furniture, glazed white-blue for plates,
  // terracotta for pots, ochre clay for amphorae.
  furniture: Object.freeze({ emoji: '🪑', label: 'Meuble', unit: unitOf('meuble', 'meubles'), colors: Object.freeze({ dark: '#6D4C41', pale: '#BCAAA4' }) }),
  plate: Object.freeze({ emoji: '🍽️', label: 'Plat', unit: unitOf('plat', 'plats'), colors: Object.freeze({ dark: '#5C7C99', pale: '#DCE6F0' }) }),
  pot: Object.freeze({ emoji: '🍲', label: 'Pot', unit: unitOf('pot', 'pots'), colors: Object.freeze({ dark: '#BF5B3A', pale: '#E8B9A3' }) }),
  amphora: Object.freeze({ emoji: '🏺', label: 'Amphore', unit: unitOf('amphore', 'amphores'), colors: Object.freeze({ dark: '#C98A2B', pale: '#F0D9A8' }) }),
  faith: Object.freeze({ emoji: '🙏', label: 'Foi' }),
  school: Object.freeze({ emoji: '🎓', label: 'École' }),
  library: Object.freeze({ emoji: '📖', label: 'Bibliothèque' }),
  doctor: Object.freeze({ emoji: '🩺', label: 'Cabinet médical' }),
  hospital: Object.freeze({ emoji: '🏥', label: 'Hôpital' }),
  publicBath: Object.freeze({ emoji: '🛁', label: 'Bains publics' }),
  theatre: Object.freeze({ emoji: '🎭', label: 'Théâtre' }),
  cinema: Object.freeze({ emoji: '🎬', label: 'Cinéma' }),
  pub: Object.freeze({ emoji: '🍺', label: 'Taverne' }),
});

/**
 * What a category with no entry here is shown as: the "…" marker, never the id or an invented icon.
 * (presentation/dom/shell/CatalogVocabulary.js also warns about it in the console.)
 */
const UNDECLARED = Object.freeze({ emoji: '…', label: '…' });

/**
 * @param {string} category
 * @returns {{ emoji: string, label: string, unit?: { one: string, many: string } }}
 */
export function getResourceCategoryPresentation(category) {
  return RESOURCE_CATEGORY_PRESENTATION[category] ?? UNDECLARED;
}

/** @param {string} category @returns {boolean} Whether the catalog names this category. */
export function hasResourceCategoryPresentation(category) {
  return Object.hasOwn(RESOURCE_CATEGORY_PRESENTATION, category);
}

/** Neutral chart colors for a category that declares none. */
const FALLBACK_COLORS = Object.freeze({ dark: '#546E7A', pale: '#B0BEC5' });

/**
 * @param {string} category
 * @returns {{ dark: string, pale: string }}
 */
export function getResourceCategoryColors(category) {
  return RESOURCE_CATEGORY_PRESENTATION[category]?.colors ?? FALLBACK_COLORS;
}
