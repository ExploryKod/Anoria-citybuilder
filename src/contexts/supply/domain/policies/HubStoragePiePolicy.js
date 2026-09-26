import { getResourceCategoryColors } from '../catalogs/ResourceCategoryCatalog.js';

/**
 * Pie slice colors for a product — declared once, in ResourceCategoryCatalog.
 * @param {string} productId
 */
export function getHubStoragePieColors(productId) {
  return getResourceCategoryColors(productId);
}

/**
 * Build pie segments for real warehouse occupation.
 *
 * Overlapping maxPercent ceilings compete for the same free space:
 * first deposit wins (Cesar III). The chart therefore shows:
 * - dark: stock currently held by each product
 * - free (grey): remaining capacity — contested, first-come-first-served
 *
 * Pale product wedges are not drawn for free space (would imply a fair split).
 *
 * @param {object} params
 * @param {ReadonlyArray<object>} params.lines enriched with emoji/label
 * @param {number} params.totalCapacity
 */
export function buildHubStoragePieSegments({ lines, totalCapacity }) {
  const capacity = Math.max(1, Math.floor(Number(totalCapacity) || 0));
  let cursor = 0;
  /** @type {object[]} */
  const segments = [];

  for (const line of lines) {
    const amount = Math.max(0, Math.floor(Number(line.amount) || 0));
    const remainingInbound = Math.max(0, Math.floor(Number(line.remainingInbound) || 0));
    const maxCap = Math.max(0, Math.floor(Number(line.maxCap) || 0));
    const darkAngle = (amount / capacity) * 360;
    const startAngle = cursor;
    cursor += darkAngle;

    segments.push(
      Object.freeze({
        productId: line.productId,
        // A good the catalog does not name is shown as the "…" marker, never as its id or an invented icon.
        emoji: line.emoji ?? '…',
        label: line.label ?? '…',
        amount,
        maxCap,
        maxPercent: line.maxPercent ?? 100,
        remainingInbound,
        startAngle,
        darkAngle,
        paleAngle: 0,
        paleStartAngle: cursor,
        segmentAngle: darkAngle,
        endAngle: cursor,
        colors: getHubStoragePieColors(line.productId),
        overMax: amount > maxCap,
        kind: 'product',
      })
    );
  }

  const freeAngle = Math.max(0, 360 - cursor);
  if (freeAngle > 0.5) {
    segments.push(
      Object.freeze({
        productId: '__free__',
        emoji: '',
        label: 'Libre (1er arrivé)',
        amount: 0,
        maxCap: 0,
        remainingInbound: 0,
        startAngle: cursor,
        darkAngle: 0,
        paleAngle: 0,
        idleAngle: freeAngle,
        segmentAngle: freeAngle,
        endAngle: 360,
        colors: { dark: '#eceff1', pale: '#f5f5f5' },
        overMax: false,
        kind: 'free',
      })
    );
  }

  return Object.freeze(segments);
}
