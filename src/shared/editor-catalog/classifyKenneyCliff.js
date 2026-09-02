/**
 * Kenney cliff_* GLBs — footprint size + material buckets for editor terrain carousels.
 */

/** @typedef {'editorCliffQuarterRock' | 'editorCliffQuarterStone' | 'editorCliffHalfRock' | 'editorCliffHalfStone' | 'editorCliffRock' | 'editorCliffStone'} KenneyCliffCategoryId */

export const KENNEY_CLIFF_CATEGORY_IDS = Object.freeze([
  'editorCliffQuarterRock',
  'editorCliffQuarterStone',
  'editorCliffHalfRock',
  'editorCliffHalfStone',
  'editorCliffRock',
  'editorCliffStone',
]);

/**
 * @param {string} glbName
 * @returns {boolean}
 */
export function isKenneyCliffGlbName(glbName) {
  return glbName.startsWith('cliff_');
}

/**
 * @param {string} glbName
 * @returns {boolean}
 */
export function isCliffQuarterFootprint(glbName) {
  return glbName.includes('Quarter');
}

/**
 * @param {string} glbName
 * @returns {boolean}
 */
export function isCliffHalfFootprint(glbName) {
  if (isCliffQuarterFootprint(glbName)) {
    return false;
  }
  if (/^cliff_half/i.test(glbName)) {
    return true;
  }
  const body = glbName.replace(/^cliff_/, '');
  return /Half/.test(body);
}

/**
 * @param {string} glbName
 * @returns {'rock' | 'stone'}
 */
export function getCliffMaterial(glbName) {
  const { material } = parseCliffGlbName(glbName);
  return material === 'stone' ? 'stone' : 'rock';
}

/**
 * @param {'quarter' | 'half' | 'full'} size
 * @param {'rock' | 'stone'} material
 * @returns {KenneyCliffCategoryId}
 */
export function cliffCategoryIdFor(size, material) {
  const materialSuffix = material === 'stone' ? 'Stone' : 'Rock';
  if (size === 'quarter') {
    return /** @type {KenneyCliffCategoryId} */ (`editorCliffQuarter${materialSuffix}`);
  }
  if (size === 'half') {
    return /** @type {KenneyCliffCategoryId} */ (`editorCliffHalf${materialSuffix}`);
  }
  return /** @type {KenneyCliffCategoryId} */ (`editorCliff${materialSuffix}`);
}

/**
 * @param {string} glbName
 * @returns {KenneyCliffCategoryId | null}
 */
export function classifyCliffCategoryId(glbName) {
  if (!isKenneyCliffGlbName(glbName)) {
    return null;
  }

  const material = getCliffMaterial(glbName);
  if (isCliffQuarterFootprint(glbName)) {
    return cliffCategoryIdFor('quarter', material);
  }
  if (isCliffHalfFootprint(glbName)) {
    return cliffCategoryIdFor('half', material);
  }
  return cliffCategoryIdFor('full', material);
}

/**
 * @param {string} glbName
 * @returns {{ shape: string, material: 'rock' | 'stone' | 'other' }}
 */
export function parseCliffGlbName(glbName) {
  if (glbName === 'cliff_rock') {
    return { shape: 'base', material: 'rock' };
  }
  if (glbName === 'cliff_stone') {
    return { shape: 'base', material: 'stone' };
  }

  const match = glbName.match(/^cliff_(.+)_(rock|stone)$/);
  if (match) {
    return { shape: match[1], material: /** @type {'rock' | 'stone'} */ (match[2]) };
  }
  return { shape: glbName, material: 'other' };
}

/** Shape families inside each cliff carousel (single material per carousel). */
const CLIFF_SHAPE_FAMILY_ORDER = Object.freeze([
  'base',
  'large',
  'block',
  'blockDiagonal',
  'blockSlope',
  'blockSlopeWalls',
  'blockCave',
  'blockHalf',
  'blockQuarter',
  'blockSlopeHalfWalls',
  'half',
  'halfCorner',
  'halfCornerInner',
  'diagonal',
  'corner',
  'cornerInner',
  'cornerInnerLarge',
  'cornerInnerTop',
  'cornerLarge',
  'cornerTop',
  'cave',
  'steps',
  'stepsCorner',
  'stepsCornerInner',
  'top',
  'topDiagonal',
  'waterfall',
  'waterfallTop',
]);

/**
 * @param {string} shape
 * @returns {number}
 */
export function cliffShapeFamilyIndex(shape) {
  const index = CLIFF_SHAPE_FAMILY_ORDER.indexOf(shape);
  return index === -1 ? CLIFF_SHAPE_FAMILY_ORDER.length + shape.localeCompare('zzz') : index;
}

/**
 * Carousel order: shape family (inclination / corner / block…), then name.
 *
 * @param {string} glbNameA
 * @param {string} glbNameB
 * @returns {number}
 */
export function compareCliffCarouselGlbs(glbNameA, glbNameB) {
  const a = parseCliffGlbName(glbNameA);
  const b = parseCliffGlbName(glbNameB);

  const familyDiff = cliffShapeFamilyIndex(a.shape) - cliffShapeFamilyIndex(b.shape);
  if (familyDiff !== 0) {
    return familyDiff;
  }

  return glbNameA.localeCompare(glbNameB);
}
