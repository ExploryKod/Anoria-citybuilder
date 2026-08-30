/**
 * Stable integer hash for procedural variety (same coords → same pick every load).
 *
 * @param {number} x
 * @param {number} y
 * @param {number} [seed=0]
 * @returns {number} non-negative integer
 */
export function deterministicHash(x, y, seed = 0) {
  let h = (seed | 0) ^ (x | 0) * 374761393 ^ (y | 0) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
