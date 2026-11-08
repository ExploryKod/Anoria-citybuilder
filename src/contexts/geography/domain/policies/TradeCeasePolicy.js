import { TRADE_EXPORT, TRADE_IMPORT } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * Why a trade stops, and who stops it. A reason is an id, who ceases (`by`) and a pure test over the cycle's context;
 * `findCeaseReason` returns the first one of a side that holds. Open to extension, closed to modification: a new
 * reason is one entry here (and its words in the catalog). The player's wording of each id is read from the catalog,
 * never written in the UI.
 *
 * Three scopes. A CITY's reason ends the whole relation (it stops buying our exports as well): `scope: 'relation'`. Our
 * MERCHANTS' reason pauses only the imports of one good, the exports go on: `scope: 'import'`; it is lifted when the
 * reason no longer holds. Exports have their own reasons (`scope: 'export'`, ids starting `export_`), so what stops an
 * export is never confused with what stops an import of the same good.
 *
 * @typedef {{
 *   relation: { satisfactionScore: number, contractEndMonth: number | null },
 *   entry: { relation: { breakThreshold: number, renewalThreshold: number } },
 *   orderMonth: number,
 *   pricing?: { unit: { sale: number } },
 *   exportPricing?: { unitNet: number, unitCost: number },
 *   baseValue?: number,
 *   homePrice?: number | null, // the market's price at home for a good the city makes itself: the ceiling an import must stay under; null for any other good
 *   failures?: Record<string, number>,
 * }} CeaseContext
 */
export const CEASE_REASONS = Object.freeze({
  satisfaction_too_low: Object.freeze({
    by: 'city',
    scope: 'relation',
    applies: ({ relation, entry }) => relation.satisfactionScore <= entry.relation.breakThreshold,
  }),
  contract_ended: Object.freeze({
    by: 'city',
    scope: 'relation',
    applies: ({ relation, entry, orderMonth }) =>
      relation.contractEndMonth !== null && orderMonth >= relation.contractEndMonth && relation.satisfactionScore < entry.relation.renewalThreshold,
  }),
  unprofitable: Object.freeze({
    by: 'merchants',
    scope: 'import',
    // The most the market pays: a multiple of the good's value, or what it charges at home for a good the city makes itself (dearer in a shortage).
    applies: ({ pricing, baseValue, homePrice = null }) => pricing.unit.sale > (homePrice ?? baseValue * TRADE_IMPORT.marketCeiling),
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
