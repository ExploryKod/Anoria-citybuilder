/**
 * Kenney rock_*, stone_*, and stump_* GLBs — material + size buckets for nature carousels.
 */

/** @typedef {'editorRockSmall' | 'editorRockLarge' | 'editorRockTall' | 'editorStoneSmall' | 'editorStoneLarge' | 'editorStoneTall' | 'editorStumps'} KenneyRockStoneCategoryId */

export const KENNEY_ROCK_STONE_CATEGORY_IDS = Object.freeze([
  'editorRockSmall',
  'editorRockLarge',
  'editorRockTall',
  'editorStoneSmall',
  'editorStoneLarge',
  'editorStoneTall',
  'editorStumps',
]);

/**
 * @param {string} glbName
 * @returns {boolean}
 */
export function isKenneyRockGlbName(glbName) {
  return glbName.startsWith('rock_');
}

/**
 * @param {string} glbName
 * @returns {boolean}
 */
export function isKenneyStoneGlbName(glbName) {
  return glbName.startsWith('stone_');
}

/**
 * @param {string} glbName
 * @returns {boolean}
 */
export function isKenneyStumpGlbName(glbName) {
  return glbName.startsWith('stump_');
}

/**
 * @param {string} glbName
 * @returns {boolean}
 */
export function isKenneyRockStoneGlbName(glbName) {
  return isKenneyRockGlbName(glbName) || isKenneyStoneGlbName(glbName);
}

/**
 * @param {string} glbName
 * @returns {'small' | 'large' | 'tall' | null}
 */
export function getRockStoneSize(glbName) {
  if (/^(?:rock|stone)_small/.test(glbName)) {
    return 'small';
  }
  if (/^(?:rock|stone)_large/.test(glbName)) {
    return 'large';
  }
  if (/^(?:rock|stone)_tall/.test(glbName)) {
    return 'tall';
  }
  return null;
}

/**
 * @param {'rock' | 'stone'} material
 * @param {'small' | 'large' | 'tall'} size
 * @returns {KenneyRockStoneCategoryId}
 */
export function rockStoneCategoryIdFor(material, size) {
  const materialPrefix = material === 'stone' ? 'Stone' : 'Rock';
  const sizeSuffix = size.charAt(0).toUpperCase() + size.slice(1);
  return /** @type {KenneyRockStoneCategoryId} */ (`editor${materialPrefix}${sizeSuffix}`);
}

/**
 * @param {string} glbName
 * @returns {KenneyRockStoneCategoryId | null}
 */
export function classifyRockStoneCategoryId(glbName) {
  if (isKenneyStumpGlbName(glbName)) {
    return 'editorStumps';
  }

  const material = isKenneyStoneGlbName(glbName)
    ? 'stone'
    : isKenneyRockGlbName(glbName)
      ? 'rock'
      : null;
  if (!material) {
    return null;
  }

  const size = getRockStoneSize(glbName);
  if (!size) {
    return null;
  }

  return rockStoneCategoryIdFor(material, size);
}

/** Shape variants inside each rock/stone size carousel. */
const ROCK_STONE_SHAPE_ORDER = Object.freeze([
  'small',
  'smallFlat',
  'smallTop',
  'large',
  'tall',
]);

/**
 * @param {string} glbName
 * @returns {string}
 */
export function parseRockStoneShape(glbName) {
  const match = glbName.match(/^(?:rock|stone)_(small(?:Flat|Top)?|large|tall)/);
  return match?.[1] ?? glbName;
}

/**
 * @param {string} shape
 * @returns {number}
 */
export function rockStoneShapeIndex(shape) {
  const index = ROCK_STONE_SHAPE_ORDER.indexOf(shape);
  return index === -1 ? ROCK_STONE_SHAPE_ORDER.length + shape.localeCompare('zzz') : index;
}

/**
 * @param {string} glbNameA
 * @param {string} glbNameB
 * @returns {number}
 */
export function compareRockStoneCarouselGlbs(glbNameA, glbNameB) {
  const shapeDiff = rockStoneShapeIndex(parseRockStoneShape(glbNameA))
    - rockStoneShapeIndex(parseRockStoneShape(glbNameB));
  if (shapeDiff !== 0) {
    return shapeDiff;
  }
  return glbNameA.localeCompare(glbNameB);
}
