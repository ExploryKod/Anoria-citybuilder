import { TRADE_EXPORT, TRADE_IMPORT } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * Why a trade stops, and who stops it. A reason is an id, who ceases (`by`) and a pure test over the cycle's context;
 * `findCeaseReason` returns the first one of a side that holds. Open to extension, closed to modification: a new
 * reason is one entry here (and its words in the catalog). The player's wording of each id is read from the catalog,
 * never written in the UI.
 *
 * Three scopes. A CITY's reason would end the whole relation (it stops buying our exports as well): `scope: 'relation'`; none is declared since the commercial
 * satisfaction stopped ending relations (it cools, it never cuts), the relation's own causes (embargo, rupture) come with its memory. Our
 * MERCHANTS' reason pauses only the imports of one good, the exports go on: `scope: 'import'`; it is lifted when the
 * reason no longer holds. Exports have their own reasons (`scope: 'export'`, ids starting `export_`), so what stops an
 * export is never confused with what stops an import of the same good.
 *
 * @typedef {{
 *   pricing?: { unit: { sale: number } },
 *   exportPricing?: { unitNet: number, unitCost: number },
 *   referencePrice?: number, // the world's reference price of the good (the ceiling of an import is a multiple of it)
 *   homePrice?: number | null, // the market's price at home for a good the city makes itself: the ceiling an import must stay under; null for any other good
 *   failures?: Record<string, number>,
 *   embargoed: boolean, // the city has decreed an embargo on this good in this flow (the relation's journal says so)
 *   partnerEmbargoed: boolean, // the partner has decreed one on us, in force now (the same journal)
 * }} CeaseContext
 */

/** The embargo of a context: it must be said, a context that does not say is a defect of its caller. */
function embargoedOf(embargoed) {
  if (typeof embargoed !== 'boolean') throw new Error(`[trade] the cease context must say whether the good is embargoed (a boolean), got ${embargoed}`);
  return embargoed;
}
export const CEASE_REASONS = Object.freeze({
  // The city's own decision (an embargo it decreed on this good, in this flow): first, so that it is the reason shown whatever else holds. Read live from the relation's journal.
  embargo: Object.freeze({
    by: 'city',
    scope: 'import',
    applies: ({ embargoed }) => embargoedOf(embargoed),
  }),
  export_embargo: Object.freeze({
    by: 'city',
    scope: 'export',
    applies: ({ embargoed }) => embargoedOf(embargoed),
  }),
  // The partner's own decision (an embargo it decreed on us, in force until its end: see PartnerPolicy).
  partner_embargo: Object.freeze({
    by: 'partner',
    scope: 'import',
    applies: ({ partnerEmbargoed }) => embargoedOf(partnerEmbargoed),
  }),
  export_partner_embargo: Object.freeze({
    by: 'partner',
    scope: 'export',
    applies: ({ partnerEmbargoed }) => embargoedOf(partnerEmbargoed),
  }),
  unprofitable: Object.freeze({
    by: 'merchants',
    scope: 'import',
    // The most the market pays: a multiple of the good's world reference price, or what it charges at home for a good the city makes itself (dearer in a shortage).
    applies: ({ pricing, referencePrice, homePrice = null }) => pricing.unit.sale > (homePrice ?? referencePrice * TRADE_IMPORT.marketCeiling),
  }),
  no_warehouse: Object.freeze({
    by: 'merchants',
    scope: 'import',
    applies: ({ failures }) => (failures.no_warehouse ?? 0) >= TRADE_IMPORT.failedOrdersBeforeCease,
  }),
  export_unprofitable: Object.freeze({
    by: 'merchants',
    scope: 'export',
    applies: ({ exportPricing }) => exportPricing.unitNet < exportPricing.unitCost,
  }),
  export_no_merchants: Object.freeze({
    by: 'merchants',
    scope: 'export',
    applies: ({ failures }) => (failures.export_no_merchants ?? 0) >= TRADE_EXPORT.failedOrdersBeforeCease,
  }),
  export_no_warehouse: Object.freeze({
    by: 'merchants',
    scope: 'export',
    applies: ({ failures }) => (failures.export_no_warehouse ?? 0) >= TRADE_EXPORT.failedOrdersBeforeCease,
  }),
  warehouse_full: Object.freeze({
    by: 'merchants',
    scope: 'import',
    applies: ({ failures }) => (failures.warehouse_full ?? 0) >= TRADE_IMPORT.failedOrdersBeforeCease,
  }),
  no_merchants: Object.freeze({
    by: 'merchants',
    scope: 'import',
    applies: ({ failures }) => (failures.no_merchants ?? 0) >= TRADE_IMPORT.failedOrdersBeforeCease,
  }),
});

/**
 * @param {'relation' | 'import' | 'export'} scope
 * @param {CeaseContext} context only what the scope's reasons read
 * @returns {{ reason: string, by: 'city' | 'merchants' } | null}
 */
export function findCeaseReason(scope, context) {
  for (const [reason, definition] of Object.entries(CEASE_REASONS)) {
    if (definition.scope !== scope) continue;
    if (definition.applies(context)) return { reason, by: definition.by };
  }
  return null;
}
