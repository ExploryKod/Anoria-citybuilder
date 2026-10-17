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
 * `kind: 'importDeal'` — a deal waiting for a real import: an agreement, not a good. It costs nothing to make (the
 * merchants are paid on delivery, not when they make the deal), so it declares a baseValue of 0, and it is not a good
 * the houses buy (see getGoodCategories). `importGood` names the imported good it will turn into.
 * `transportWeight` — an imported good's weight/volume factor in the transport charge (see TradeCatalog `transport`).
 */
const BASKET = Object.freeze({ one: 'panier', many: 'paniers' });
const unitOf = (one, many) => Object.freeze({ one, many });
export const RESOURCE_CATEGORY_PRESENTATION = Object.freeze({
  wheat:  Object.freeze({ vatCategory: 'essential', emoji: '🌾', label: 'Blé',     unit: BASKET, baseValue: 0.8,  colors: Object.freeze({ dark: '#F9A825', pale: '#FFF59D' }) }),
  cabbage: Object.freeze({ vatCategory: 'essential', emoji: '🥬', label: 'Chou',   unit: BASKET, baseValue: 0.5,  colors: Object.freeze({ dark: '#388E3C', pale: '#A5D6A7' }) }),
  carrot: Object.freeze({ vatCategory: 'essential', emoji: '🥕', label: 'Carotte', unit: BASKET, baseValue: 0.6,  colors: Object.freeze({ dark: '#EF6C00', pale: '#FFCC80' }) }),
  // Imported goods: bought from a trade city (see TradeCatalog `offers`), never made here.
  coal:   Object.freeze({ vatCategory: 'other', emoji: '⛏️', label: 'Charbon', unit: unitOf('tonne', 'tonnes'), baseValue: 1.2, transportWeight: 3, colors: Object.freeze({ dark: '#37474F', pale: '#B0BEC5' }) }),
  petrol: Object.freeze({ vatCategory: 'other', emoji: '🛢️', label: 'Pétrole', unit: unitOf('baril', 'barils'), baseValue: 3.0, transportWeight: 1, colors: Object.freeze({ dark: '#4E342E', pale: '#BCAAA4' }) }),
  uranium: Object.freeze({ vatCategory: 'other', emoji: '☢️', label: 'Uranium', unit: unitOf('fût', 'fûts'), baseValue: 8.0, transportWeight: 1, colors: Object.freeze({ dark: '#558B2F', pale: '#DCEDC8' }) }),
  exoticWood: Object.freeze({ vatCategory: 'luxury', emoji: '🌳', label: 'Bois exotique', unit: unitOf('bille', 'billes'), baseValue: 4.0, transportWeight: 2, colors: Object.freeze({ dark: '#7B1F2E', pale: '#E3A4AE' }) }),
  dattes: Object.freeze({ vatCategory: 'essential', emoji: '🌴', label: 'Dattes',  unit: BASKET, baseValue: 1.2,  colors: Object.freeze({ dark: '#795548', pale: '#D7CCC8' }) }),
  wood:   Object.freeze({ vatCategory: 'essential', emoji: '🪵', label: 'Bois', unit: unitOf('bûche', 'bûches'), baseValue: 1.0, colors: Object.freeze({ dark: '#6D4C2C', pale: '#D4BC8C' }) }),
  food: Object.freeze({ emoji: '🍽️', label: 'Nourriture', unit: BASKET }),
  heat: Object.freeze({ emoji: '🔥', label: 'Chauffage', unit: unitOf('unité', 'unités') }),
  // Lighting: olive green for oil, beeswax for candles.
  olive: Object.freeze({ vatCategory: 'essential', emoji: '🫒', label: 'Olive', unit: unitOf('olive', 'olives'), baseValue: 0.4, colors: Object.freeze({ dark: '#556B2F', pale: '#C5D19A' }) }),
  oil:    Object.freeze({ vatCategory: 'essential', emoji: '🪔', label: 'Huile',  unit: unitOf('jarre', 'jarres'),   baseValue: 2.0, colors: Object.freeze({ dark: '#B59B2E', pale: '#EBDDA0' }) }),
  candle: Object.freeze({ vatCategory: 'essential', emoji: '🕯️', label: 'Bougie', unit: unitOf('bougie', 'bougies'), baseValue: 1.5, colors: Object.freeze({ dark: '#D9B84A', pale: '#F6EDC4' }) }),
  light: Object.freeze({ emoji: '💡', label: 'Éclairage', unit: unitOf('unité', 'unités') }),
  goods: Object.freeze({ emoji: '📦', label: 'Biens', unit: unitOf('bien', 'biens') }),
  // Activité — chaque maison a sa propre petite entreprise (voir ARTISAN/SAVANT/MERCHANT_ACTIVITY_ROLES).
  bandwidth: Object.freeze({ vatCategory: 'other', emoji: '📶', label: 'Accès réseau', unit: unitOf('unité', 'unités'), baseValue: 0, colors: Object.freeze({ dark: '#2E6B8A', pale: '#A8D0E0' }) }),
  decoratedPot: Object.freeze({ vatCategory: 'art', emoji: '🏺', label: 'Pot décoré',  unit: unitOf('pot décoré', 'pots décorés'), baseValue: 8.0,  colors: Object.freeze({ dark: '#C9702B', pale: '#F0C79A' }) }),
  carrotCake: Object.freeze({ vatCategory: 'luxury', emoji: '🥕', label: 'Carrot cake', unit: unitOf('gâteau', 'gâteaux'), baseValue: 6.0, colors: Object.freeze({ dark: '#D98A2E', pale: '#F5D9A8' }) }),
  book:   Object.freeze({ vatCategory: 'luxury', emoji: '📚', label: 'Livre', unit: unitOf('livre', 'livres'),     baseValue: 15.0, colors: Object.freeze({ dark: '#5B4636', pale: '#C9B79C' }) }),
  dealWood:        Object.freeze({ emoji: '🤝', label: 'Export bois',       unit: unitOf('vente', 'ventes'), standsFor: 'wood', colors: Object.freeze({ dark: '#6D4C2C', pale: '#D4BC8C' }) }),
  dealDecoratedPot: Object.freeze({ emoji: '🤝', label: 'Export pot décoré', unit: unitOf('vente', 'ventes'), standsFor: 'decoratedPot', colors: Object.freeze({ dark: '#C9702B', pale: '#F0C79A' }) }),
  dealBook:        Object.freeze({ emoji: '🤝', label: 'Export livre',       unit: unitOf('vente', 'ventes'), standsFor: 'book', colors: Object.freeze({ dark: '#5B4636', pale: '#C9B79C' }) }),
  dealCarrotCake:  Object.freeze({ emoji: '🤝', label: 'Export carrot cake', unit: unitOf('vente', 'ventes'), standsFor: 'carrotCake', colors: Object.freeze({ dark: '#D98A2E', pale: '#F5D9A8' }) }),
  // Deals waiting for an import: made by the merchants' business, turned into the real good when the city delivers.
  dealCoal:        Object.freeze({ kind: 'importDeal', importGood: 'coal', emoji: '🤝', label: 'Import charbon', unit: unitOf('accord', 'accords'), baseValue: 0, colors: Object.freeze({ dark: '#37474F', pale: '#B0BEC5' }) }),
  dealPetrol:      Object.freeze({ kind: 'importDeal', importGood: 'petrol', emoji: '🤝', label: 'Import pétrole', unit: unitOf('accord', 'accords'), baseValue: 0, colors: Object.freeze({ dark: '#4E342E', pale: '#BCAAA4' }) }),
  dealUranium:     Object.freeze({ kind: 'importDeal', importGood: 'uranium', emoji: '🤝', label: 'Import uranium', unit: unitOf('accord', 'accords'), baseValue: 0, colors: Object.freeze({ dark: '#558B2F', pale: '#DCEDC8' }) }),
  dealExoticWood:  Object.freeze({ kind: 'importDeal', importGood: 'exoticWood', emoji: '🤝', label: 'Import bois exotique', unit: unitOf('accord', 'accords'), baseValue: 0, colors: Object.freeze({ dark: '#7B1F2E', pale: '#E3A4AE' }) }),
  // Chart colors follow what the good is made of: walnut for furniture, glazed white-blue for plates,
  // terracotta for pots, ochre clay for amphorae.
  furniture: Object.freeze({ vatCategory: 'craft', emoji: '🪑', label: 'Meuble',  unit: unitOf('meuble', 'meubles'),   baseValue: 20.0, colors: Object.freeze({ dark: '#6D4C41', pale: '#BCAAA4' }) }),
  plate:     Object.freeze({ vatCategory: 'craft', emoji: '🍽️', label: 'Plat',    unit: unitOf('plat', 'plats'),        baseValue: 5.0,  colors: Object.freeze({ dark: '#5C7C99', pale: '#DCE6F0' }) }),
  pot:       Object.freeze({ vatCategory: 'craft', emoji: '🍲', label: 'Pot',     unit: unitOf('pot', 'pots'),           baseValue: 3.0,  colors: Object.freeze({ dark: '#BF5B3A', pale: '#E8B9A3' }) }),
  amphora:   Object.freeze({ vatCategory: 'craft', emoji: '🏺', label: 'Amphore', unit: unitOf('amphore', 'amphores'),   baseValue: 4.0,  colors: Object.freeze({ dark: '#C98A2B', pale: '#F0D9A8' }) }),
  // Deposits of the map.
  rock: Object.freeze({ emoji: '🪨', label: 'Pierre', unit: unitOf('bloc', 'blocs') }),
  clay: Object.freeze({ emoji: '🧱', label: 'Argile', unit: unitOf('bloc', 'blocs') }),
  iron: Object.freeze({ emoji: '⚙️', label: 'Fer', unit: unitOf('lingot', 'lingots') }),
  gold: Object.freeze({ emoji: '🥇', label: 'Or', unit: unitOf('lingot', 'lingots') }),
  // Services travel the same chain as goods: each delivered unit is priced here, and the city subsidises its share.
  // Water: a need of every house like the diet, drawn from a tank's reservoir (the land's groundwater), a cubic metre at a time.
  water: Object.freeze({ kind: 'service', vatCategory: 'essential', emoji: '💧', label: 'Eau', unit: unitOf('mètre cube', 'mètres cubes'), baseValue: 0.125 }),
  // Energy: a need of every house, made by a plant from coal or petrol and handed out to the houses it reaches.
  energy: Object.freeze({ kind: 'service', vatCategory: 'other', emoji: '⚡', label: 'Énergie', unit: unitOf('MWh', 'MWh'), baseValue: 0.1 }),
  fire: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '🚒', label: 'Pompiers', unit: unitOf('intervention', 'interventions'), baseValue: 1 }),
  police: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '🚓', label: 'Police', unit: unitOf('patrouille', 'patrouilles'), baseValue: 1 }),
  school: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '🎓', label: 'École', unit: unitOf('leçon', 'leçons'), baseValue: 1.5 }),
  library: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '📖', label: 'Bibliothèque', unit: unitOf('prêt', 'prêts'), baseValue: 1 }),
  doctor: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '🩺', label: 'Cabinet médical', unit: unitOf('consultation', 'consultations'), baseValue: 2 }),
  hospital: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '🏥', label: 'Hôpital', unit: unitOf('soin', 'soins'), baseValue: 3 }),
  theatre: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '🎭', label: 'Théâtre', unit: unitOf('représentation', 'représentations'), baseValue: 1.5 }),
  cinema: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '🎬', label: 'Cinéma', unit: unitOf('séance', 'séances'), baseValue: 1.2 }),
  pub: Object.freeze({ kind: 'service', vatCategory: 'service', emoji: '🍽️', label: 'Café-restaurant', unit: unitOf('repas', 'repas'), baseValue: 0.6 }),
});

/**
 * What a household's purchases are grouped into, in the order its budget lists them: the household's consumption by purpose, after the
 * international nomenclature of household consumption (COICOP, `coicop` is the division's number). Each group names the categories a house
 * buys (a good at a market, a service on its bill). A category a house buys must be in one, or `householdConsumptionGroupOf` throws.
 */
export const HOUSEHOLD_CONSUMPTION_GROUPS = Object.freeze([
  Object.freeze({ id: 'food', coicop: '01', label: 'Alimentation', categories: Object.freeze(['wheat', 'cabbage', 'carrot', 'dattes']) }),
  Object.freeze({ id: 'housing', coicop: '04', label: 'Logement, eau et énergie', categories: Object.freeze(['water', 'energy', 'wood', 'oil', 'candle']) }),
  Object.freeze({ id: 'equipment', coicop: '05', label: 'Équipement du ménage', categories: Object.freeze(['furniture', 'plate', 'pot', 'amphora']) }),
  Object.freeze({ id: 'health', coicop: '06', label: 'Santé', categories: Object.freeze(['doctor', 'hospital']) }),
  Object.freeze({ id: 'leisure', coicop: '09', label: 'Loisirs et culture', categories: Object.freeze(['library', 'theatre', 'cinema']) }),
  Object.freeze({ id: 'education', coicop: '10', label: 'Enseignement', categories: Object.freeze(['school']) }),
  Object.freeze({ id: 'restaurants', coicop: '11', label: 'Restauration', categories: Object.freeze(['pub']) }),
  Object.freeze({ id: 'other', coicop: '12', label: 'Autres biens et services', categories: Object.freeze(['fire', 'police']) }),
]);

/**
 * The consumption group of a category a house bought.
 * @param {string} category
 * @returns {{ id: string, coicop: string, label: string, categories: readonly string[] }}
 */
export function householdConsumptionGroupOf(category) {
  const group = HOUSEHOLD_CONSUMPTION_GROUPS.find((candidate) => candidate.categories.includes(category));
  if (!group) throw new Error(`[resource-catalog] "${category}" is bought by a household but is in no HOUSEHOLD_CONSUMPTION_GROUPS: declare its group`);
  return group;
}

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
 * The goods: the categories that are neither a service, nor a deal (an export deal stands for a good sold to another city,
 * an import deal for one still to be bought),
 * nor a deposit of the map (no baseValue: it is mined, not sold to the houses).
 * @returns {string[]}
 */
export function getGoodCategories() {
  return Object.keys(RESOURCE_CATEGORY_PRESENTATION).filter((category) => {
    const entry = RESOURCE_CATEGORY_PRESENTATION[category];
    return entry.kind !== 'service' && entry.kind !== 'importDeal' && entry.standsFor === undefined && typeof entry.baseValue === 'number';
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

/**
 * How long a good keeps, in months, before it goes bad, kept where it has no better place than a field or a stall. `Infinity` for a good that never
 * does: it is then not aged at all, whatever the place it is kept in. The months are the calendar's (they do not change with the days a month has).
 * A place that keeps a good longer says so with a `shelfLifeFactor` on its hub role (a granary for the food, a warehouse for the other goods).
 * Every good that can sit in a stock must be here: `getShelfLifeMonths` throws for one that is not. First values, to tune with a play-through: a year's
 * food has to keep from one harvest to the next in a granary, so the crops that feed the citizens live a quarter of that unprotected.
 */
const SHELF_LIFE_MONTHS = Object.freeze({
  wheat: 6, carrot: 3, cabbage: 2, dattes: 6, olive: 1, oil: 18, carrotCake: 1, wood: 36,
  coal: Infinity, petrol: Infinity, uranium: Infinity, exoticWood: Infinity, candle: Infinity,
  decoratedPot: Infinity, book: Infinity, furniture: Infinity, plate: Infinity, pot: Infinity, amphora: Infinity,
  rock: Infinity, clay: Infinity, iron: Infinity, gold: Infinity, bandwidth: Infinity,
  // An agreement waiting for its import is not a good: it never goes bad.
  dealCoal: Infinity, dealPetrol: Infinity, dealUranium: Infinity, dealExoticWood: Infinity,
});

/**
 * @param {string} category
 * @returns {number} months, or `Infinity` for a good that never goes bad
 */
export function getShelfLifeMonths(category) {
  if (!hasResourceCategoryPresentation(category)) {
    throw new Error(`[resource-catalog] "${category}" is not declared in ResourceCategoryCatalog: it has no shelf life`);
  }
  const entry = RESOURCE_CATEGORY_PRESENTATION[category];
  if (entry.standsFor) return getShelfLifeMonths(entry.standsFor);
  const months = SHELF_LIFE_MONTHS[category];
  if (!(months > 0)) throw new Error(`[resource-catalog] "${category}" declares no shelf life: add one in SHELF_LIFE_MONTHS (Infinity for a good that never goes bad)`);
  return months;
}

/**
 * The delivery cycle of a good, in months: the span over which what it lost to spoilage is set against what went through the stock (the shelf-life
 * screen's "spoiled out of total"). The food comes in once a year, with the harvest; the others follow the rhythm of their making. First values, to
 * tune with a play-through.
 */
const DELIVERY_CYCLE_MONTHS = Object.freeze({
  wheat: 12, carrot: 12, cabbage: 12, dattes: 12, olive: 12, oil: 12, carrotCake: 1, wood: 12,
});

/**
 * @param {string} category a good that can go bad
 * @returns {number} months
 */
export function getDeliveryCycleMonths(category) {
  if (!hasResourceCategoryPresentation(category)) {
    throw new Error(`[resource-catalog] "${category}" is not declared in ResourceCategoryCatalog: it has no delivery cycle`);
  }
  const entry = RESOURCE_CATEGORY_PRESENTATION[category];
  if (entry.standsFor) return getDeliveryCycleMonths(entry.standsFor);
  const months = DELIVERY_CYCLE_MONTHS[category];
  if (!(months > 0)) throw new Error(`[resource-catalog] "${category}" declares no delivery cycle: add one in DELIVERY_CYCLE_MONTHS`);
  return months;
}

/**
 * The goods that declare a shelf life, an agreement waiting for its import excepted (it is not a good): what the shelf-life screen lists.
 * @returns {string[]}
 */
export function listShelfLifeGoods() {
  return Object.keys(SHELF_LIFE_MONTHS).filter((category) => RESOURCE_CATEGORY_PRESENTATION[category]?.kind !== 'importDeal');
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

/**
 * An imported good's weight/volume factor in the transport charge. Throws when the catalog declares none: a good that
 * crosses a border by sea or land has a weight.
 * @param {string} category
 * @returns {number}
 */
export function getTransportWeight(category) {
  const weight = RESOURCE_CATEGORY_PRESENTATION[category]?.transportWeight;
  if (typeof weight !== 'number' || !(weight > 0)) {
    throw new Error(`[resource-catalog] "${category}" declares no transportWeight: add one to ResourceCategoryCatalog`);
  }
  return weight;
}

/**
 * The imported good a deal turns into.
 * @param {string} dealCategory
 * @returns {string}
 */
export function getImportGoodOfDeal(dealCategory) {
  const good = RESOURCE_CATEGORY_PRESENTATION[dealCategory]?.importGood;
  if (!good) throw new Error(`[resource-catalog] "${dealCategory}" is not an import deal: it names no importGood`);
  return good;
}
