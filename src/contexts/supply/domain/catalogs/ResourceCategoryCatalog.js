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
 * `baseValue` (optional, €/unit) — declared only on goods that can be traded
 * with other cities. It is the reference price before any demand multiplier is
 * applied; the actual sale price = baseValue × city.demandMultiplier.
 * Goods with no baseValue cannot be exported.
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
  olive: Object.freeze({ emoji: '🫒', label: 'Olive', unit: unitOf('olive', 'olives'), colors: Object.freeze({ dark: '#556B2F', pale: '#C5D19A' }) }),
  oil:    Object.freeze({ emoji: '🪔', label: 'Huile',  unit: unitOf('jarre', 'jarres'),   baseValue: 2.0, colors: Object.freeze({ dark: '#B59B2E', pale: '#EBDDA0' }) }),
  candle: Object.freeze({ emoji: '🕯️', label: 'Bougie', unit: unitOf('bougie', 'bougies'), baseValue: 1.5, colors: Object.freeze({ dark: '#D9B84A', pale: '#F6EDC4' }) }),
  light: Object.freeze({ emoji: '💡', label: 'Éclairage', unit: unitOf('unité', 'unités') }),
  goods: Object.freeze({ emoji: '📦', label: 'Biens', unit: unitOf('bien', 'biens') }),
  // Activité — chaque maison a sa propre petite entreprise (voir ARTISAN/SAVANT/MERCHANT_ACTIVITY_ROLES).
  bandwidth: Object.freeze({ emoji: '📶', label: 'Accès réseau', unit: unitOf('unité', 'unités'), colors: Object.freeze({ dark: '#2E6B8A', pale: '#A8D0E0' }) }),
  decoratedPot: Object.freeze({ emoji: '🏺', label: 'Pot décoré',  unit: unitOf('pot décoré', 'pots décorés'), baseValue: 8.0,  colors: Object.freeze({ dark: '#C9702B', pale: '#F0C79A' }) }),
  carrotCake: Object.freeze({ emoji: '🥕', label: 'Carrot cake', unit: unitOf('gâteau', 'gâteaux'), baseValue: 6.0, colors: Object.freeze({ dark: '#D98A2E', pale: '#F5D9A8' }) }),
  book:   Object.freeze({ emoji: '📚', label: 'Livre', unit: unitOf('livre', 'livres'),     baseValue: 15.0, colors: Object.freeze({ dark: '#5B4636', pale: '#C9B79C' }) }),
  dealWood:        Object.freeze({ emoji: '🤝', label: 'Export bois',       unit: unitOf('vente', 'ventes'), colors: Object.freeze({ dark: '#6D4C2C', pale: '#D4BC8C' }) }),
  dealDecoratedPot: Object.freeze({ emoji: '🤝', label: 'Export pot décoré', unit: unitOf('vente', 'ventes'), colors: Object.freeze({ dark: '#C9702B', pale: '#F0C79A' }) }),
  dealBook:        Object.freeze({ emoji: '🤝', label: 'Export livre',       unit: unitOf('vente', 'ventes'), colors: Object.freeze({ dark: '#5B4636', pale: '#C9B79C' }) }),
  dealCarrotCake:  Object.freeze({ emoji: '🤝', label: 'Export carrot cake', unit: unitOf('vente', 'ventes'), colors: Object.freeze({ dark: '#D98A2E', pale: '#F5D9A8' }) }),
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

/**
 * Base price in € for one unit of `category`, or null if the good is not
 * exportable. Used by the trade system as the reference before applying a
 * city's demand multiplier.
 * @param {string} category
 * @returns {number | null}
 */
export function getResourceBaseValue(category) {
  return RESOURCE_CATEGORY_PRESENTATION[category]?.baseValue ?? null;
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
