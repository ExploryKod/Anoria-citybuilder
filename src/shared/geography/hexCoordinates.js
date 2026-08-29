import { KENNEY_HEX_DEFAULT_RADIUS } from '../../contexts/geography/domain/catalogs/HexAssetCatalog.js';

/** @typedef {{ q: number, r: number }} HexPosition */

const SQRT3 = Math.sqrt(3);

/**
 * Pointy-top axial → world pixels (origin at 0,0 hex centre).
 * @param {HexPosition} hex
 * @param {number} [hexSize]
 */
export function axialToPixel(hex, hexSize = KENNEY_HEX_DEFAULT_RADIUS) {
  return {
    x: hexSize * (SQRT3 * hex.q + (SQRT3 / 2) * hex.r),
    y: hexSize * ((3 / 2) * hex.r),
  };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} [hexSize]
 * @returns {HexPosition}
 */
export function pixelToAxial(x, y, hexSize = KENNEY_HEX_DEFAULT_RADIUS) {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / hexSize;
  const r = ((2 / 3) * y) / hexSize;
  return axialRound(q, r);
}

/**
 * @param {number} q
 * @param {number} r
 * @returns {HexPosition}
 */
export function axialRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

/**
 * @param {HexPosition} hex
 */
export function hexKey(hex) {
  return `${hex.q},${hex.r}`;
}

/**
 * @param {HexPosition} a
 * @param {HexPosition} b
 */
export function hexDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/**
 * Pointy-top hex corner vertices for outline (centre at origin).
 * @param {number} [hexSize]
 * @returns {Array<{ x: number, y: number }>}
 */
export function hexCornerPoints(hexSize = KENNEY_HEX_DEFAULT_RADIUS) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i) - 30) * (Math.PI / 180);
    points.push({
      x: hexSize * Math.cos(angle),
      y: hexSize * Math.sin(angle),
    });
  }
  return points;
}
