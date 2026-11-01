import { PLANTATION_PROP_IDS } from '../editor-catalog/naturePropCatalog.js';

/**
 * The uses a plot of land can be sold for. The town hall marks tiles "for sale for a use"; the plot is bounded by fences, nothing can be built on it, and a
 * buyer of that use plants on it. Only forests for now; a new use is one entry here (its sub-tab in the construction menu follows).
 *
 * `pricePerTile`: what a buyer pays the city for one tile (a first value, to tune in play).
 * `fenceAssetId`: the Kenney nature piece that bounds a plot of this use (a straight fence along a tile's edge).
 */
export const LAND_USES = Object.freeze({
  forest: Object.freeze({
    label: 'Forêts',
    singular: 'forêt',
    pricePerTile: 20,
    fenceAssetId: 'nature-prop:fence_simple',
    // What the owner of a forest plot grows on it, tile by tile: a plant, which becomes a tree after `months` and a high tree after the tree's `months`; a tree or high tree
    // used up leaves the tile fallow for `fallowMonths`, then a plant is set again. `yields` is what a full tree holds of the resource the owner gathers (the 200 of
    // the high tree is twice the tree's). The years are 12 months (MONTHS_PER_YEAR). First values, to tune by playing.
    crop: Object.freeze({
      stages: Object.freeze({
        plant: Object.freeze({ prop: PLANTATION_PROP_IDS.plant, months: 12 }),
        tree: Object.freeze({ prop: PLANTATION_PROP_IDS.tree, months: 12, yields: 100 }),
        treeHigh: Object.freeze({ prop: PLANTATION_PROP_IDS.treeHigh, yields: 200 }),
      }),
      fallowMonths: 1,
    }),
  }),
});

export function landUseIds() {
  return Object.keys(LAND_USES);
}

/** @param {string} useId */
export function getLandUse(useId) {
  const use = LAND_USES[useId];
  if (!use) throw new Error(`[LandUseCatalog] no land use "${useId}" (known: ${landUseIds().join(', ')})`);
  return use;
}
