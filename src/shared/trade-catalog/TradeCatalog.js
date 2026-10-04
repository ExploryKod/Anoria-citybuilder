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
 *   openingRequirements — conditions to open the relation (empty = always open);
 *                     add new keys here as canOpenRelation.js implements each check
 *
 * @typedef {{
 *   cityId: string,
 *   wants: ReadonlyArray<{ good: string, merchantGood: string, baseMultiplier: number }>,
 *   relation: { durationMonths: number, renewalThreshold: number, breakThreshold: number },
 *   trade: { frequencyMonths: number, quantityPerOrder: number },
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
    openingRequirements: Object.freeze({}),
  },
]);

/**
 * @param {string} cityId
 * @returns {TradeCatalogEntry | null}
 */
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
