import { getResourceCategoryColors } from '../catalogs/ResourceCategoryCatalog.js';
import { reconcileLots } from './HubLotsPolicy.js';

/**
 * Pie slice colors for a product — declared once, in ResourceCategoryCatalog.
 * @param {string} productId
 */
export function getHubStoragePieColors(productId) {
  return getResourceCategoryColors(productId);
}

/**
 * A tone of a good's colour, to tell apart the same good from different producers: index 0 is the colour
 * itself, the next ones alternate lighter and darker (same hue, so it stays recognisably that good).
 * @param {string} hex `#RRGGBB`
 * @param {number} index
 * @returns {string} `#RRGGBB`
 */
export function toneVariant(hex, index) {
  const deltas = [0, 0.14, -0.12, 0.26, -0.22];
  const delta = deltas[index % deltas.length];
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const nl = Math.min(0.92, Math.max(0.12, l + delta));
  const c = (1 - Math.abs(2 * nl - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = nl - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * What a good in the hub is made of, by who delivered it: one part per producer type (in key order), each with
 * its own tone of the good's colour, sized in degrees of the good's dark wedge.
 * @param {ReadonlyArray<[string, number]>} lots `[producerType, amount]`
 * @param {number} amount
 * @param {number} startAngle
 * @param {number} capacity
 * @param {string} baseColor
 */
function buildParts(lots, startAngle, capacity, baseColor) {
  let cursor = startAngle;
  return lots.map(([producerType, lotAmount], index) => {
    const angle = (lotAmount / capacity) * 360;
    const part = Object.freeze({ producerType, amount: lotAmount, startAngle: cursor, angle, color: toneVariant(baseColor, index) });
    cursor += angle;
    return part;
  });
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
    const colors = getHubStoragePieColors(line.productId);
    // Where this good came from: one part per producer type, told apart by tone.
    const lots = Object.entries(reconcileLots(line.lots, amount)).sort(([a], [b]) => a.localeCompare(b));
    const parts = buildParts(lots, startAngle, capacity, colors.dark);

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
        colors,
        parts,
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
