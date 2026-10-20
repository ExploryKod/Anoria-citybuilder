/**
 * Trade catalog — which cities Anoria can trade with, what they want, at what
 * price multiplier, and the terms of the commercial relationship.
 *
 * Intentionally separate from WorldCityCatalog (geography) and
 * ResourceCategoryCatalog (presentation): trade rules are economic, not visual.
 *
 * Each entry declares:
 *   cityId          — matches a WorldCityCatalog id
 *   wants           — goods this city will buy, each with a baseMultiplier applied
 *                     on top of the good's own ResourceCategoryCatalog.baseValue. For a want with a
 *                     `merchantGood` (our merchants export it, see RunMonthlyCityTradeCycle.js), the merchants bought the
 *                     good from a warehouse at the value chain's hub price (baseValue × 1.2 × 1.2, ValueChainCatalog) and pay the good's
 *                     export duty (set per good in the customs panel; FiscalRateCatalog's default is 0, 15% on wood) on the sale:
 *                     baseMultiplier must clear 1.44 / (1 − duty) — 1.44 at no duty, about 1.7 at 15% — or the merchants cease
 *                     to export it (`export_unprofitable`). The buying city pays the freight.
 *   offers          — goods this city SELLS to Anoria (imports), each with a baseMultiplier on the good's baseValue
 *                     (the city's price per unit), a quantity per order (cq) and the `merchantGood` deal that Anoria's
 *                     merchants make for it. Delivered to a trade warehouse on the order months (`trade.frequencyMonths`, ct),
 *                     against the deals the merchants hold; see TRADE_IMPORT for who pays what.
 *   transport       — how the goods reach Anoria: a `mode` (a key of TRADE_IMPORT.transportModes) and the city's
 *                     `distanceMultiplier` on that mode's base price.
 *   relation        — contract duration and satisfaction thresholds: `breakThreshold` is the score at or below which the
 *                     city ceases to deal (-100..100); `renewalThreshold` the score a contract needs to be renewed
 *   trade           — order rhythm and quantity per order
 *   satisfaction    — the factors that move the relation's satisfaction (see TradeSatisfactionPolicy.js);
 *                     each review sums them into one number 0..100
 *   sale            — the price range a merchant sells at: `spread` is how far the ratio can move from
 *                     a want's baseMultiplier (±), `drawWidth` the width of the random draw (0..1 of the spread).
 *                     Events and the relation move the range's centre through the cycle's saleBias.
 *   openingRequirements — conditions to open the relation (empty = always open);
 *                     add new keys here as canOpenRelation.js implements each check
 *
 * @typedef {{
 *   cityId: string,
 *   wants: ReadonlyArray<{ good: string, merchantGood: string, baseMultiplier: number }>,
 *   offers: ReadonlyArray<{ good: string, merchantGood: string, baseMultiplier: number, quantityPerOrder: number }>,
 *   transport: { mode: string, distanceMultiplier: number },
 *   relation: { durationMonths: number, renewalThreshold: number, breakThreshold: number },
 *   trade: { frequencyMonths: number, quantityPerOrder: number },
 *   sale: { spread: number, drawWidth: number },
 *   culture: string, // what the city's trade is like, for the player: no figures
 *   satisfaction: ReadonlyArray<{ name: string, [param: string]: number }>,
 *   openingRequirements: {
 *     minMerchants?: number,
 *     minAttractiveness?: number,
 *     giftsSent?: number,
 *     ideology?: string,
 *     noWarWith?: string[],
 *   },
 * }} TradeCatalogEntry
 */

/**
 * How an import is priced and when the merchants give it up. Per unit, in this order:
 *   foreign price      = the good's baseValue × the offer's baseMultiplier        (to the city, outside Anoria)
 *   transport          = the mode's basePrice × the city's distanceMultiplier × the good's transportWeight
 *                        × (1 − the discount of the delivery's volume tier)         (to carriers, outside Anoria)
 *   customs duty       = (foreign price + transport) × the good's import duty      (to the city's treasury)
 *   merchants' margin  = (foreign price + transport + duty) × merchantMargin       (to the merchant houses)
 * The duty's base is the customs value: the price plus every charge generated outside Anoria, never the merchants'
 * margin, which is earned inside it.
 *   marketCeiling      — the most the market pays for one unit, as a multiple of the good's baseValue: when the
 *                        landed price plus margin is above it, the merchants cease to deal (`unprofitable`).
 *   failedOrdersBeforeCease — consecutive order months the warehouse could not take or pay before the merchants stop.
 *   dealLifetimeMonths — a waiting deal older than this is dropped (`expired`).
 */
export const TRADE_IMPORT = Object.freeze({
  merchantMargin: 0.10,
  marketCeiling: 2.2,
  failedOrdersBeforeCease: 3,
  dealLifetimeMonths: 6,
  transportModes: Object.freeze({
    land: Object.freeze({ basePrice: 0.04 }),
    sea: Object.freeze({ basePrice: 0.05 }),
  }),
  /** The per-unit transport discount from this delivery size up (units): the largest tier reached applies. */
  volumeTiers: Object.freeze([
    Object.freeze({ from: 10, discount: 0.05 }),
    Object.freeze({ from: 25, discount: 0.10 }),
    Object.freeze({ from: 40, discount: 0.15 }),
  ]),
});

/**
 * How an export is priced and when the merchants give it up. Per unit, our merchants buy the good from a warehouse at the
 * value chain's hub price (their cost), sell it to the city at its drawn price, and pay Anoria's export duty on that sale.
 * The buying city pays the freight (its own merchants bring the goods home), so an export carries no transport charge.
 *   failedOrdersBeforeCease — consecutive order months with no deal waiting before the merchants stop.
 * The merchants cease when the price at the centre of the range, duty taken off, does not cover their cost (`export_unprofitable`).
 */
export const TRADE_EXPORT = Object.freeze({
  failedOrdersBeforeCease: 3,
});

/**
 * What the player reads when a trade stops: who ceased (`by`, see TradeCeasePolicy) and why. One line per reason id of
 * CEASE_REASONS; a reason with no line here is shown as "…" with a warning, never as its id.
 */
export const TRADE_CEASE_WORDING = Object.freeze({
  by: Object.freeze({ city: 'La ville a cessé', merchants: 'Nos marchands ont cessé' }),
  reasons: Object.freeze({
    satisfaction_too_low: 'sa confiance en nous est épuisée',
    contract_ended: 'le contrat est arrivé à son terme sans être renouvelé',
    unprofitable: "le prix rendu, droits et transport compris, dépasse ce que le marché paie",
    export_unprofitable: "la vente, droits déduits, ne couvre plus le prix d'achat des marchandises",
    export_no_merchants: "aucun accord d'export n'attend : aucune maison de négociants ne les prépare",
    export_no_warehouse: "pas d'entrepôt commercial disponible (aucun entrepôt commercial existant)",
    no_warehouse: "pas d'entrepôt commercial disponible (aucun entrepôt commercial existant)",
    warehouse_full: "pas d'entrepôt commercial disponible (aucune place en entrepôt commercial)",
    no_merchants: "aucun accord n'attend : aucune maison de négociants ne les prépare",
  }),
});

/** @type {ReadonlyArray<TradeCatalogEntry>} */
export const TRADE_CATALOG = Object.freeze([
  {
    cityId: 'olivea',
    wants: Object.freeze([
      { good: 'wood', merchantGood: 'dealWood', baseMultiplier: 1.9 },
      { good: 'pot',  merchantGood: null,        baseMultiplier: 1.3 },
      { good: 'oil',  merchantGood: null,        baseMultiplier: 1.4 },
    ]),
    offers: Object.freeze([]),
    relation: Object.freeze({ durationMonths: 12, renewalThreshold: 60, breakThreshold: -80 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.0 }),
    trade: Object.freeze({ frequencyMonths: 1, quantityPerOrder: 30 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    culture: "Négociants patients et méthodiques, nés de la culture de l'olivier. Ils bâtissent leur confiance lentement mais la gardent longtemps : un partenaire qui tient ses engagements finit par devenir indispensable. Ils recherchent surtout l'huile, les pots et le bois.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 1, loss: 2 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'silvania',
    wants: Object.freeze([
      { good: 'book',         merchantGood: 'dealBook',         baseMultiplier: 1.8 },
      { good: 'decoratedPot', merchantGood: 'dealDecoratedPot', baseMultiplier: 1.75 },
    ]),
    offers: Object.freeze([{ good: 'exoticWood', merchantGood: 'dealExoticWood', baseMultiplier: 1.5, quantityPerOrder: 15 }]),
    relation: Object.freeze({ durationMonths: 6, renewalThreshold: 70, breakThreshold: -40 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.2 }),
    trade: Object.freeze({ frequencyMonths: 2, quantityPerOrder: 20 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    culture: "Forestiers et enthousiastes, ils s'enflamment pour les belles pièces. Leur confiance grimpe vite après une bonne livraison, mais un manquement la fait retomber tout aussi vite. Ils collectionnent les livres et les pots décorés.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 3, loss: 6 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'briga',
    wants: Object.freeze([
      { good: 'wheat',  merchantGood: null, baseMultiplier: 1.1 },
      { good: 'carrot', merchantGood: null, baseMultiplier: 1.1 },
    ]),
    offers: Object.freeze([{ good: 'coal', merchantGood: 'dealCoal', baseMultiplier: 1.35, quantityPerOrder: 40 }]),
    relation: Object.freeze({ durationMonths: 6, renewalThreshold: 50, breakThreshold: -60 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.5 }),
    trade: Object.freeze({ frequencyMonths: 3, quantityPerOrder: 50 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    culture: "Village isolé et pragmatique. Pas de goût particulier pour la nouveauté : ils achètent le grain et les légumes qui nourrissent leurs foyers. Réguliers mais peu bavards, ils jugent un partenaire à la régularité de ses livraisons.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 5 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'piceta',
    wants: Object.freeze([
      { good: 'wheat', merchantGood: null, baseMultiplier: 1.2 },
      { good: 'oil',   merchantGood: null, baseMultiplier: 1.45 },
    ]),
    offers: Object.freeze([{ good: 'uranium', merchantGood: 'dealUranium', baseMultiplier: 1.3, quantityPerOrder: 10 }]),
    relation: Object.freeze({ durationMonths: 12, renewalThreshold: 55, breakThreshold: -60 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.8 }),
    trade: Object.freeze({ frequencyMonths: 3, quantityPerOrder: 20 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    culture: "Cité minière bâtie autour de ses galeries, où l'on extrait le minerai qui alimente les plus grandes centrales. Les mineurs ne mangent pas ce qu'ils creusent : ils achètent le blé et l'huile en gros, paient comptant et jugent un partenaire à la ponctualité de ses convois.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 4 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'maris',
    wants: Object.freeze([
      { good: 'furniture', merchantGood: null, baseMultiplier: 1.6 },
      { good: 'amphora',   merchantGood: null, baseMultiplier: 1.3 },
      { good: 'carrotCake', merchantGood: 'dealCarrotCake', baseMultiplier: 1.7 },
    ]),
    offers: Object.freeze([{ good: 'petrol', merchantGood: 'dealPetrol', baseMultiplier: 1.4, quantityPerOrder: 20 }]),
    relation: Object.freeze({ durationMonths: 24, renewalThreshold: 50, breakThreshold: -70 }),
    transport: Object.freeze({ mode: 'sea', distanceMultiplier: 2.0 }),
    trade: Object.freeze({ frequencyMonths: 1, quantityPerOrder: 15 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    culture: "Port habitué aux marchandises de luxe et aux commandes fréquentes. Exigeants sur les meubles et les amphores, ils passent commande chaque mois et ne font confiance qu'à la constance.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 5 })]),
    openingRequirements: Object.freeze({}),
  },
]);

/**
 * @param {string} cityId
 * @returns {TradeCatalogEntry | null}
 */
/**
 * A partner's satisfaction runs both ways: a city can hold the merchants in its debt (negative) or favour them.
 * A new relation starts at the middle of the scale.
 */
export const SATISFACTION_RANGE = Object.freeze({ min: -100, max: 100 });
export const SATISFACTION_START = 0;

export function getTradeCatalogEntry(cityId) {
  return TRADE_CATALOG.find((e) => e.cityId === cityId) ?? null;
}

/**
 * Every good a trade city sells to Anoria.
 * @returns {string[]}
 */
export function listImportedGoods() {
  return [...new Set(TRADE_CATALOG.flatMap((entry) => entry.offers.map((offer) => offer.good)))];
}

/**
 * Every good that crosses a border, with the flows it takes: exported (a city `wants` it) and/or imported (a city
 * `offers` it). One row per good, in the order the catalog first names it.
 * @returns {Array<{ good: string, flows: Array<'import' | 'export'> }>}
 */
export function listTradedGoods() {
  /** @type {Map<string, Set<'import' | 'export'>>} */
  const flowsByGood = new Map();
  const note = (good, flow) => flowsByGood.set(good, (flowsByGood.get(good) ?? new Set()).add(flow));
  for (const entry of TRADE_CATALOG) {
    for (const want of entry.wants) note(want.good, 'export');
    for (const offer of entry.offers) note(offer.good, 'import');
  }
  return [...flowsByGood].map(([good, flows]) => ({ good, flows: ['import', 'export'].filter((flow) => flows.has(flow)) }));
}

/**
 * All city ids that have a trade catalog entry.
 * @returns {string[]}
 */
export function listTradePartnerIds() {
  return TRADE_CATALOG.map((e) => e.cityId);
}

/**
 * Transport per unit of one delivery. The volume tier is read from the delivery's size (units): the largest tier whose
 * `from` is reached applies, none below the first.
 * @param {{ cityId: string, good: string, quantity: number, weight: number }} delivery weight = the good's transportWeight
 * @returns {number} the per-unit transport charge, unrounded
 */
export function transportPerUnit({ cityId, quantity, weight }) {
  const entry = getTradeCatalogEntry(cityId);
  if (!entry) throw new Error(`[trade] "${cityId}" is not in the trade catalog`);
  const mode = TRADE_IMPORT.transportModes[entry.transport.mode];
  if (!mode) throw new Error(`[trade] ${cityId} ships by "${entry.transport.mode}", which TRADE_IMPORT.transportModes does not declare`);
  const tier = [...TRADE_IMPORT.volumeTiers].reverse().find((candidate) => quantity >= candidate.from);
  return mode.basePrice * entry.transport.distanceMultiplier * weight * (1 - (tier?.discount ?? 0));
}
