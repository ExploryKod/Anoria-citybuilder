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
 *                     on top of the good's own ResourceCategoryCatalog.baseValue
 *   relation        — contract duration and satisfaction thresholds
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

/** @type {ReadonlyArray<TradeCatalogEntry>} */
export const TRADE_CATALOG = Object.freeze([
  {
    cityId: 'olivea',
    wants: Object.freeze([
      { good: 'wood', merchantGood: 'dealWood', baseMultiplier: 1.2 },
      { good: 'pot',  merchantGood: null,        baseMultiplier: 1.3 },
      { good: 'oil',  merchantGood: null,        baseMultiplier: 1.4 },
    ]),
    relation: Object.freeze({ durationMonths: 12, renewalThreshold: 60, breakThreshold: 20 }),
    trade: Object.freeze({ frequencyMonths: 1, quantityPerOrder: 30 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    culture: "Négociants patients et méthodiques, nés de la culture de l'olivier. Ils bâtissent leur confiance lentement mais la gardent longtemps : un partenaire qui tient ses engagements finit par devenir indispensable. Ils recherchent surtout l'huile, les pots et le bois.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 1, loss: 2 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'silvania',
    wants: Object.freeze([
      { good: 'book',         merchantGood: 'dealBook',         baseMultiplier: 1.5 },
      { good: 'decoratedPot', merchantGood: 'dealDecoratedPot', baseMultiplier: 1.4 },
    ]),
    relation: Object.freeze({ durationMonths: 6, renewalThreshold: 70, breakThreshold: 30 }),
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
    relation: Object.freeze({ durationMonths: 6, renewalThreshold: 50, breakThreshold: 15 }),
    trade: Object.freeze({ frequencyMonths: 3, quantityPerOrder: 50 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    culture: "Village isolé et pragmatique. Pas de goût particulier pour la nouveauté : ils achètent le grain et les légumes qui nourrissent leurs foyers. Réguliers mais peu bavards, ils jugent un partenaire à la régularité de ses livraisons.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 5 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'maris',
    wants: Object.freeze([
      { good: 'furniture', merchantGood: null, baseMultiplier: 1.6 },
      { good: 'amphora',   merchantGood: null, baseMultiplier: 1.3 },
      { good: 'carrotCake', merchantGood: 'dealCarrotCake', baseMultiplier: 1.3 },
    ]),
    relation: Object.freeze({ durationMonths: 24, renewalThreshold: 50, breakThreshold: 10 }),
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
 * All city ids that have a trade catalog entry.
 * @returns {string[]}
 */
export function listTradePartnerIds() {
  return TRADE_CATALOG.map((e) => e.cityId);
}
