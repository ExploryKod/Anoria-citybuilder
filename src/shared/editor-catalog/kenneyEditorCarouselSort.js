import {
  compareCliffCarouselGlbs,
  isKenneyCliffGlbName,
  KENNEY_CLIFF_CATEGORY_IDS,
} from './classifyKenneyCliff.js';
import {
  compareRockStoneCarouselGlbs,
  isKenneyRockStoneGlbName,
  KENNEY_ROCK_STONE_CATEGORY_IDS,
} from './classifyKenneyRockStone.js';

const CLIFF_CATEGORY_IDS = new Set(KENNEY_CLIFF_CATEGORY_IDS);
const ROCK_STONE_CATEGORY_IDS = new Set(KENNEY_ROCK_STONE_CATEGORY_IDS);

/**
 * @typedef {{ toolId: string, glbName: string }} KenneyCarouselAssetRef
 */

/**
 * @param {string} categoryId
 * @param {readonly KenneyCarouselAssetRef[]} assets
 * @returns {string[]}
 */
export function sortKenneyCarouselToolIds(categoryId, assets) {
  if (CLIFF_CATEGORY_IDS.has(categoryId)) {
    return [...assets]
      .sort((assetA, assetB) => {
        const { glbName: glbA } = assetA;
        const { glbName: glbB } = assetB;
        if (isKenneyCliffGlbName(glbA) && isKenneyCliffGlbName(glbB)) {
          return compareCliffCarouselGlbs(glbA, glbB);
        }
        return glbA.localeCompare(glbB);
      })
      .map((asset) => asset.toolId);
  }

  if (ROCK_STONE_CATEGORY_IDS.has(categoryId)) {
    return [...assets]
      .sort((assetA, assetB) => {
        const { glbName: glbA } = assetA;
        const { glbName: glbB } = assetB;
        if (isKenneyRockStoneGlbName(glbA) && isKenneyRockStoneGlbName(glbB)) {
          return compareRockStoneCarouselGlbs(glbA, glbB);
        }
        return glbA.localeCompare(glbB);
      })
      .map((asset) => asset.toolId);
  }

  return [...assets]
    .sort((a, b) => a.glbName.localeCompare(b.glbName))
    .map((asset) => asset.toolId);
}
