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
 *
 * `baseValue` (€/unit) — the value of one unit, read by every exchange: the
 * supply traceability logs each transfer at this price, and a city export sells
 * at baseValue × the sale ratio the trade cycle draws (see shared/trade-catalog). Every good that moves between buildings
 * must declare one (0 for a free service); getResourceBaseValue throws otherwise.
 * `standsFor` — a merchant's deal good is the same unit as the raw good it was
 * made from, so it is priced as that good and declares no baseValue of its own.
 */
const BASKET = Object.freeze({ one: 'panier', many: 'paniers' });
const unitOf = (one, many) => Object.freeze({ one, many });
export const RESOURCE_CATEGORY_PRESENTATION = Object.freeze({
  wheat:  Object.freeze({ emoji: '🌾', label: 'Blé',     unit: BASKET, baseValue: 0.8,  colors: Object.freeze({ dark: '#F9A825', pale: '#FFF59D' }) }),
  cabbage: Object.freeze({ emoji: '🥬', label: 'Chou',   unit: BASKET, baseValue: 0.5,  colors: Object.freeze({ dark: '#388E3C', pale: '#A5D6A7' }) }),
  carrot: Object.freeze({ emoji: '🥕', label: 'Carotte', unit: BASKET, baseValue: 0.6,  colors: Object.freeze({ dark: '#EF6C00', pale: '#FFCC80' }) }),
  fruit:  Object.freeze({ emoji: '🍎', label: 'Fruits',  unit: BASKET, baseValue: 1.0,  colors: Object.freeze({ dark: '#C62828', pale: '#EF9A9A' }) }),
  game:   Object.freeze({ emoji: '🦌', label: 'Gibier',  unit: BASKET, baseValue: 1.5,  colors: Object.freeze({ dark: '#8D5B45', pale: '#D7B8A8' }) }),
  dattes: Object.freeze({ emoji: '🌴', label: 'Dattes',  unit: BASKET, baseValue: 1.2,  colors: Object.freeze({ dark: '#795548', pale: '#D7CCC8' }) }),
  wood:   Object.freeze({ emoji: '🪵', label: 'Bois', unit: unitOf('bûche', 'bûches'), baseValue: 1.0, colors: Object.freeze({ dark: '#6D4C2C', pale: '#D4BC8C' }) }),
  food: Object.freeze({ emoji: '🍽️', label: 'Nourriture', unit: BASKET }),
  heat: Object.freeze({ emoji: '🔥', label: 'Chauffage', unit: unitOf('unité', 'unités') }),
  // Lighting: olive green for oil, beeswax for candles.
  olive: Object.freeze({ emoji: '🫒', label: 'Olive', unit: unitOf('olive', 'olives'), baseValue: 0.4, colors: Object.freeze({ dark: '#556B2F', pale: '#C5D19A' }) }),
  oil:    Object.freeze({ emoji: '🪔', label: 'Huile',  unit: unitOf('jarre', 'jarres'),   baseValue: 2.0, colors: Object.freeze({ dark: '#B59B2E', pale: '#EBDDA0' }) }),
  candle: Object.freeze({ emoji: '🕯️', label: 'Bougie', unit: unitOf('bougie', 'bougies'), baseValue: 1.5, colors: Object.freeze({ dark: '#D9B84A', pale: '#F6EDC4' }) }),
  light: Object.freeze({ emoji: '💡', label: 'Éclairage', unit: unitOf('unité', 'unités') }),
  goods: Object.freeze({ emoji: '📦', label: 'Biens', unit: unitOf('bien', 'biens') }),
  // Activité — chaque maison a sa propre petite entreprise (voir ARTISAN/SAVANT/MERCHANT_ACTIVITY_ROLES).
  bandwidth: Object.freeze({ emoji: '📶', label: 'Accès réseau', unit: unitOf('unité', 'unités'), baseValue: 0, colors: Object.freeze({ dark: '#2E6B8A', pale: '#A8D0E0' }) }),
  decoratedPot: Object.freeze({ emoji: '🏺', label: 'Pot décoré',  unit: unitOf('pot décoré', 'pots décorés'), baseValue: 8.0,  colors: Object.freeze({ dark: '#C9702B', pale: '#F0C79A' }) }),
  carrotCake: Object.freeze({ emoji: '🥕', label: 'Carrot cake', unit: unitOf('gâteau', 'gâteaux'), baseValue: 6.0, colors: Object.freeze({ dark: '#D98A2E', pale: '#F5D9A8' }) }),
  book:   Object.freeze({ emoji: '📚', label: 'Livre', unit: unitOf('livre', 'livres'),     baseValue: 15.0, colors: Object.freeze({ dark: '#5B4636', pale: '#C9B79C' }) }),
  dealWood:        Object.freeze({ emoji: '🤝', label: 'Export bois',       unit: unitOf('vente', 'ventes'), standsFor: 'wood', colors: Object.freeze({ dark: '#6D4C2C', pale: '#D4BC8C' }) }),
  dealDecoratedPot: Object.freeze({ emoji: '🤝', label: 'Export pot décoré', unit: unitOf('vente', 'ventes'), standsFor: 'decoratedPot', colors: Object.freeze({ dark: '#C9702B', pale: '#F0C79A' }) }),
  dealBook:        Object.freeze({ emoji: '🤝', label: 'Export livre',       unit: unitOf('vente', 'ventes'), standsFor: 'book', colors: Object.freeze({ dark: '#5B4636', pale: '#C9B79C' }) }),
  dealCarrotCake:  Object.freeze({ emoji: '🤝', label: 'Export carrot cake', unit: unitOf('vente', 'ventes'), standsFor: 'carrotCake', colors: Object.freeze({ dark: '#D98A2E', pale: '#F5D9A8' }) }),
  // Chart colors follow what the good is made of: walnut for furniture, glazed white-blue for plates,
  // terracotta for pots, ochre clay for amphorae.
  furniture: Object.freeze({ emoji: '🪑', label: 'Meuble',  unit: unitOf('meuble', 'meubles'),   baseValue: 20.0, colors: Object.freeze({ dark: '#6D4C41', pale: '#BCAAA4' }) }),
  plate:     Object.freeze({ emoji: '🍽️', label: 'Plat',    unit: unitOf('plat', 'plats'),        baseValue: 5.0,  colors: Object.freeze({ dark: '#5C7C99', pale: '#DCE6F0' }) }),
  pot:       Object.freeze({ emoji: '🍲', label: 'Pot',     unit: unitOf('pot', 'pots'),           baseValue: 3.0,  colors: Object.freeze({ dark: '#BF5B3A', pale: '#E8B9A3' }) }),
  amphora:   Object.freeze({ emoji: '🏺', label: 'Amphore', unit: unitOf('amphore', 'amphores'),   baseValue: 4.0,  colors: Object.freeze({ dark: '#C98A2B', pale: '#F0D9A8' }) }),
  // Deposits of the map.
  rock: Object.freeze({ emoji: '🪨', label: 'Pierre', unit: unitOf('bloc', 'blocs') }),
  clay: Object.freeze({ emoji: '🧱', label: 'Argile', unit: unitOf('bloc', 'blocs') }),
  iron: Object.freeze({ emoji: '⚙️', label: 'Fer', unit: unitOf('lingot', 'lingots') }),
  gold: Object.freeze({ emoji: '🥇', label: 'Or', unit: unitOf('lingot', 'lingots') }),
  // Services travel the same chain as goods: each delivered unit is priced here, and the city subsidises its share.
  faith: Object.freeze({ kind: 'service', emoji: '🙏', label: 'Foi', baseValue: 0.5 }),
  school: Object.freeze({ kind: 'service', emoji: '🎓', label: 'École', baseValue: 1.5 }),
  library: Object.freeze({ kind: 'service', emoji: '📖', label: 'Bibliothèque', baseValue: 1 }),
  doctor: Object.freeze({ kind: 'service', emoji: '🩺', label: 'Cabinet médical', baseValue: 2 }),
  hospital: Object.freeze({ kind: 'service', emoji: '🏥', label: 'Hôpital', baseValue: 3 }),
  publicBath: Object.freeze({ kind: 'service', emoji: '🛁', label: 'Bains publics', baseValue: 0.8 }),
  theatre: Object.freeze({ kind: 'service', emoji: '🎭', label: 'Théâtre', baseValue: 1.5 }),
  cinema: Object.freeze({ kind: 'service', emoji: '🎬', label: 'Cinéma', baseValue: 1.2 }),
  pub: Object.freeze({ kind: 'service', emoji: '🍺', label: 'Taverne', baseValue: 0.6 }),
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

/** Every category the catalog declares a service: its buildings give a social service to the houses. */
export function getServiceCategories() {
  return Object.keys(RESOURCE_CATEGORY_PRESENTATION).filter((category) => RESOURCE_CATEGORY_PRESENTATION[category].kind === 'service');
}

/**
 * The goods: the categories that are neither a service nor an export deal (a deal stands for a good sold to another city).
 * @returns {string[]}
 */
export function getGoodCategories() {
  return Object.keys(RESOURCE_CATEGORY_PRESENTATION).filter((category) => {
    const entry = RESOURCE_CATEGORY_PRESENTATION[category];
    return entry.kind !== 'service' && entry.standsFor === undefined;
  });
}

/** @param {string} category @returns {boolean} Whether the catalog names this category. */
export function hasResourceCategoryPresentation(category) {
  return Object.hasOwn(RESOURCE_CATEGORY_PRESENTATION, category);
}

/**
 * Value in € of one unit of `category` — the price every exchange of it is logged and taxed at.
 * Throws when the catalog does not declare one: a missing price is a catalog defect, never a stand-in.
 * @param {string} category
 * @returns {number}
 */
export function getResourceBaseValue(category) {
  if (!hasResourceCategoryPresentation(category)) {
    throw new Error(`[resource-catalog] "${category}" is not declared in ResourceCategoryCatalog: it has no price`);
  }
  const entry = RESOURCE_CATEGORY_PRESENTATION[category];
  if (entry.standsFor) return getResourceBaseValue(entry.standsFor);
  if (typeof entry.baseValue !== 'number') {
    throw new Error(`[resource-catalog] "${category}" declares no baseValue: add one (0 for a free service)`);
  }
  return entry.baseValue;
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
