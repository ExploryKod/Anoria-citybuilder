/**
 * @param {number} hex
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/**
 * @param {[number, number, number]} rgb
 * @returns {number}
 */
function rgbToHex([r, g, b]) {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

/**
 * Linear RGB blend between two 0xRRGGBB colors.
 *
 * @param {number} hexA
 * @param {number} hexB
 * @param {number} t 0–1
 * @returns {number}
 */
export function blendTerrainColorHex(hexA, hexB, t) {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  return rgbToHex([
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  ]);
}

/**
 * @param {number} hex
 * @returns {string}
 */
export function terrainColorHexToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
