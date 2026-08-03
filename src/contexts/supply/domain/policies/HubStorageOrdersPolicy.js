import { listHubProducts } from '../catalogs/HubStorageCatalog.js';

/** @typedef {'accept'|'refuse'|'fetch'} HubStorageMode */

export const HUB_STORAGE_MODES = Object.freeze(['accept', 'refuse', 'fetch']);

export const HUB_STORAGE_MODE_LABELS = Object.freeze({
  accept: 'Accepter',
  refuse: 'Refuser',
  fetch: 'Amener',
});

/** Step for +/- on max percent (Cesar III-style fill ceiling). */
export const HUB_STORAGE_PERCENT_STEP = 10;

/** Minimum non-zero ceiling when accepting/fetching (0 = refuse via mode). */
export const HUB_STORAGE_PERCENT_MIN = 10;

export const HUB_STORAGE_PERCENT_MAX = 100;

/**
 * Per-good storage order on hub buildings (`hubStorageOrders`).
 *
 * Cesar III inspired:
 * - `mode`: accept | refuse | fetch (pull from elsewhere)
 * - `maxPercent`: fill this good up to X% of total warehouse capacity
 *   (plafond — shared free space, not reserved slots)
 *
 * @typedef {{
 *   mode: HubStorageMode,
 *   maxPercent: number,
 * }} HubStorageProductOrder
 */

/** @returns {HubStorageProductOrder} */
export function createDefaultHubProductOrder(_productCount = 1) {
  return {
    mode: 'accept',
    maxPercent: HUB_STORAGE_PERCENT_MAX,
  };
}

/**
 * Clamp percent to valid step range.
 * @param {unknown} value
 */
export function clampHubStoragePercent(value) {
  const raw = Number(value);
  const n = Number.isFinite(raw) ? Math.floor(raw) : HUB_STORAGE_PERCENT_MAX;
  const stepped = Math.round(n / HUB_STORAGE_PERCENT_STEP) * HUB_STORAGE_PERCENT_STEP;
  return Math.max(
    HUB_STORAGE_PERCENT_MIN,
    Math.min(HUB_STORAGE_PERCENT_MAX, stepped)
  );
}

/**
 * @param {unknown} entry
 * @param {number} productCount
 * @returns {HubStorageProductOrder}
 */
function normalizeOneHubOrder(entry, productCount) {
  if (entry && typeof entry === 'object' && 'mode' in entry) {
    const mode = HUB_STORAGE_MODES.includes(entry.mode) ? entry.mode : 'accept';

    if ('maxPercent' in entry) {
      return { mode, maxPercent: clampHubStoragePercent(entry.maxPercent) };
    }

    // Legacy shareNum/shareDen → percent
    const shareNum = Math.max(1, Math.floor(Number(entry.shareNum) || 1));
    const shareDen = Math.max(shareNum, Math.floor(Number(entry.shareDen) || productCount || 1));
    const maxPercent = clampHubStoragePercent(Math.round((100 * shareNum) / shareDen));
    return { mode, maxPercent };
  }

  // Legacy: acceptIncoming + slotUnits
  const legacy = /** @type {Record<string, unknown>} */ (entry || {});
  const mode = legacy.acceptIncoming === false ? 'refuse' : 'accept';
  const slotUnits = Math.max(0, Math.floor(Number(legacy.slotUnits) || 0));
  if (slotUnits > 0) {
    const den = Math.max(slotUnits, productCount || 1);
    return {
      mode,
      maxPercent: clampHubStoragePercent(Math.round((100 * slotUnits) / den)),
    };
  }
  return createDefaultHubProductOrder(productCount);
}

/**
 * @param {Record<string, HubStorageProductOrder>|null|undefined} raw
 * @param {ReadonlyArray<string>} productIds
 * @returns {Record<string, HubStorageProductOrder>}
 */
export function normalizeHubStorageOrders(raw, productIds) {
  const count = Math.max(1, productIds.length);
  /** @type {Record<string, HubStorageProductOrder>} */
  const orders = {};
  for (const productId of productIds) {
    orders[productId] = normalizeOneHubOrder(raw?.[productId], count);
  }
  return orders;
}

/**
 * @param {HubStorageMode} mode
 */
export function cycleHubStorageMode(mode) {
  const idx = HUB_STORAGE_MODES.indexOf(mode);
  if (idx < 0) return 'accept';
  return HUB_STORAGE_MODES[(idx + 1) % HUB_STORAGE_MODES.length];
}

/**
 * Adjust max percent by ±step.
 *
 * @param {HubStorageProductOrder} order
 * @param {number} deltaSteps positive = +10%, negative = -10%
 */
export function adjustHubStoragePercent(order, deltaSteps) {
  const step = Math.sign(deltaSteps) * HUB_STORAGE_PERCENT_STEP * Math.abs(Math.floor(deltaSteps) || 1);
  return {
    ...order,
    maxPercent: clampHubStoragePercent((order.maxPercent ?? HUB_STORAGE_PERCENT_MAX) + step),
  };
}

/** @deprecated use adjustHubStoragePercent */
export const adjustHubStorageShare = adjustHubStoragePercent;

/**
 * Attempt to adjust percent; blocks reduction when current stock exceeds new max cap.
 *
 * @param {object} params
 * @param {HubStorageProductOrder} params.order
 * @param {number} params.deltaSteps
 * @param {number} params.currentAmount
 * @param {number} params.totalCapacity
 */
export function tryAdjustHubStoragePercent({ order, deltaSteps, currentAmount, totalCapacity }) {
  const nextOrder = adjustHubStoragePercent(order, deltaSteps);
  const newMaxCap = getHubProductMaxUnits(nextOrder, totalCapacity);
  const stock = Math.max(0, Math.floor(Number(currentAmount) || 0));

  if (deltaSteps < 0 && stock > newMaxCap) {
    return Object.freeze({
      ok: false,
      reason: 'stock_exceeds_new_max',
      currentAmount: stock,
      newMaxCap,
      newPercent: nextOrder.maxPercent,
      order: nextOrder,
    });
  }

  return Object.freeze({
    ok: true,
    order: nextOrder,
    newMaxCap,
    newPercent: nextOrder.maxPercent,
  });
}

/** @deprecated use tryAdjustHubStoragePercent */
export function tryAdjustHubStorageShare({ order, delta, currentAmount, totalCapacity }) {
  return tryAdjustHubStoragePercent({
    order,
    deltaSteps: delta,
    currentAmount,
    totalCapacity,
  });
}

/**
 * Max units one product may hold = floor(totalCapacity × maxPercent / 100).
 *
 * @param {HubStorageProductOrder} order
 * @param {number} totalCapacity
 */
export function getHubProductMaxUnits(order, totalCapacity) {
  const cap = Math.max(0, Math.floor(Number(totalCapacity) || 0));
  const percent = clampHubStoragePercent(order?.maxPercent);
  return Math.min(cap, Math.floor((cap * percent) / 100));
}

/** @deprecated Use getHubProductMaxUnits */
export const getHubProductAllocatedUnits = getHubProductMaxUnits;

/**
 * Max storable for one product (per-good ceiling).
 */
export function getHubProductStorageCeiling({
  productId,
  orders,
  totalCapacity,
}) {
  const order = orders[productId] ?? createDefaultHubProductOrder(1);
  return getHubProductMaxUnits(order, totalCapacity);
}

/**
 * Remaining inbound capacity for a product.
 * Limited by per-good max AND shared free space.
 * When several goods are at 100% (or overlapping ceilings), free space is
 * first-come-first-served: whoever deposits first takes it.
 */
export function getHubProductRemainingInbound({
  productId,
  productIds,
  orders,
  stocks,
  totalCapacity,
}) {
  const order = orders[productId] ?? createDefaultHubProductOrder(productIds.length);
  if (order.mode === 'refuse') return 0;

  const current = Math.max(0, Math.floor(Number(stocks[productId]) || 0));
  const maxForProduct = getHubProductStorageCeiling({ productId, orders, totalCapacity });
  const totalStock = productIds.reduce(
    (sum, id) => sum + Math.max(0, Math.floor(Number(stocks[id]) || 0)),
    0
  );
  const byProductMax = Math.max(0, maxForProduct - current);
  const bySharedSpace = Math.max(0, totalCapacity - totalStock);
  return Math.min(byProductMax, bySharedSpace);
}

export function canCreditHubProduct({
  productId,
  productIds,
  orders,
  stocks,
  totalCapacity,
  quantity,
}) {
  if (quantity <= 0) return false;
  const order = orders[productId];
  if (order?.mode === 'refuse') return false;
  return (
    getHubProductRemainingInbound({
      productId,
      productIds,
      orders,
      stocks,
      totalCapacity,
    }) >= quantity
  );
}

/**
 * @param {Record<string, HubStorageProductOrder>} orders
 * @param {Record<string, number>} stocks
 * @param {string} productId
 */
export function getHubProductExportableAmount(orders, stocks, productId) {
  return Math.max(0, Math.floor(Number(stocks[productId]) || 0));
}

/**
 * @param {object} params
 * @param {'barn'|'windmill'} params.hubKind
 * @param {Record<string, number>} params.stocks
 * @param {Record<string, HubStorageProductOrder>|null|undefined} params.rawOrders
 * @param {number} params.totalCapacity
 */
export function buildHubStorageLines({ hubKind, stocks, rawOrders, totalCapacity }) {
  const productIds = listHubProducts(hubKind);
  const orders = normalizeHubStorageOrders(rawOrders, productIds);
  const currentTotal = productIds.reduce(
    (sum, id) => sum + Math.max(0, Math.floor(Number(stocks[id]) || 0)),
    0
  );

  const lines = productIds.map((productId) => {
    const order = orders[productId];
    const amount = Math.max(0, Math.floor(Number(stocks[productId]) || 0));
    const maxCap = getHubProductMaxUnits(order, totalCapacity);
    const ceiling = getHubProductStorageCeiling({ productId, orders, totalCapacity });

    return Object.freeze({
      productId,
      mode: order.mode,
      modeLabel: HUB_STORAGE_MODE_LABELS[order.mode] ?? order.mode,
      maxPercent: order.maxPercent,
      percentLabel: `${order.maxPercent} %`,
      amount,
      ceiling,
      maxCap,
      /** @deprecated use maxCap */
      allocated: maxCap,
      exportable: getHubProductExportableAmount(orders, stocks, productId),
      remainingInbound: getHubProductRemainingInbound({
        productId,
        productIds,
        orders,
        stocks,
        totalCapacity,
      }),
    });
  });

  return Object.freeze({
    productIds,
    orders,
    totalCapacity,
    currentTotal,
    remainingTotal: Math.max(0, totalCapacity - currentTotal),
    lines: Object.freeze(lines),
  });
}

/**
 * Products configured to pull stock from elsewhere.
 *
 * @param {Record<string, HubStorageProductOrder>} orders
 */
export function listHubFetchProductIds(orders) {
  return Object.keys(orders).filter((id) => orders[id]?.mode === 'fetch');
}
