/** Pie slice colors per commodity (dark = current stock). */
export const HUB_STORAGE_PIE_COLORS = Object.freeze({
  wood: Object.freeze({ dark: '#6D4C2C', pale: '#D4BC8C' }),
  furniture: Object.freeze({ dark: '#5D4037', pale: '#BCAAA4' }),
  figs: Object.freeze({ dark: '#6A1B9A', pale: '#CE93D8' }),
  wheat: Object.freeze({ dark: '#F9A825', pale: '#FFF59D' }),
  cabbage: Object.freeze({ dark: '#388E3C', pale: '#A5D6A7' }),
  carrot: Object.freeze({ dark: '#EF6C00', pale: '#FFCC80' }),
  dattes: Object.freeze({ dark: '#795548', pale: '#D7CCC8' }),
});

/**
 * @param {string} productId
 */
export function getHubStoragePieColors(productId) {
  return (
    HUB_STORAGE_PIE_COLORS[productId] ?? {
      dark: '#546E7A',
      pale: '#B0BEC5',
    }
  );
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
        emoji: line.emoji ?? '',
        label: line.label ?? line.productId,
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
