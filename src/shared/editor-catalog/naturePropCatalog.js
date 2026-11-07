import { kenneyNatureGlbUrl } from './editorKenneyCatalog.js';
import { KENNEY_NATURE_ASSETS } from './kenneyNatureKitManifest.generated.js';

const PROP_COLOR_BY_CATEGORY = Object.freeze({
  editorTrees: 0x2fe7c5,
  editorPlants: 0x6ecf8a,
  editorRockSmall: 0xb8dce8,
  editorRockLarge: 0xb8dce8,
  editorRockTall: 0xb8dce8,
  editorStoneSmall: 0xc8ccd0,
  editorStoneLarge: 0xc8ccd0,
  editorStoneTall: 0xc8ccd0,
  editorStumps: 0xa08060,
  editorStructures: 0xd4c4a8,
  editorDetails: 0xc9b896,
});

/**
 * @param {string} glbName
 * @param {string} categoryId
 */
function naturePropEntry(glbName, categoryId) {
  return {
    kind: 'nature-prop',
    glb: kenneyNatureGlbUrl(glbName),
    glbName,
    displayColor: PROP_COLOR_BY_CATEGORY[categoryId] ?? 0x8fd4c4,
    surfaceY: 0.02,
    tags: ['nature', 'prop', categoryId],
  };
}

/**
 * The trees a forest plot grows (Kenney mini-forest kit, not the nature kit: they are planted by the game, never by the map editor, so they are not in its manifest):
 * a plant, then a tree, then a high tree. `glbName` is the kit's file (`plant.glb`, `tree.glb`, `tree-high.glb`); the id carries the kit so it cannot be taken for a
 * piece of the nature kit.
 */
const MINI_FOREST_GLB_BASE = '/resources/kenney_mini-forest_1.0/Models/GLB format';
export const PLANTATION_PROP_IDS = Object.freeze({
  plant: 'nature-prop:mini-forest_plant',
  tree: 'nature-prop:mini-forest_tree',
  treeHigh: 'nature-prop:mini-forest_tree-high',
});
const PLANTATION_PROPS = Object.freeze({
  [PLANTATION_PROP_IDS.plant]: { kitFile: 'plant', category: 'editorPlants' },
  [PLANTATION_PROP_IDS.tree]: { kitFile: 'tree', category: 'editorTrees' },
  [PLANTATION_PROP_IDS.treeHigh]: { kitFile: 'tree-high', category: 'editorTrees' },
});

/** @type {Record<string, ReturnType<typeof naturePropEntry>>} */
export const NATURE_PROP_CATALOG = Object.freeze({
  ...Object.fromEntries(
    KENNEY_NATURE_ASSETS
      .filter((asset) => asset.layer === 'prop')
      .map((asset) => [
        asset.toolId,
        naturePropEntry(asset.glbName, asset.categoryId),
      ])
  ),
  ...Object.fromEntries(
    Object.entries(PLANTATION_PROPS).map(([propId, { kitFile, category }]) => [
      propId,
      { ...naturePropEntry(propId.replace('nature-prop:', ''), category), glb: `${MINI_FOREST_GLB_BASE}/${kitFile}.glb` },
    ])
  ),
});

/**
 * What stands on a tile and stops a building from being placed there (it is not removed: the player is told the way is blocked): the trees, the rocks and
 * stones, the stumps, the structures (bridges, fences...) and the details (a bed, a canoe, a cactus). The plants (flowers, grass, mushrooms, moss) do not
 * stop anything, but the bushes (`plant_bush*`) do.
 */
const BLOCKING_PROP_CATEGORIES = Object.freeze(new Set([
  'editorTrees',
  'editorRockSmall',
  'editorRockLarge',
  'editorRockTall',
  'editorStoneSmall',
  'editorStoneLarge',
  'editorStoneTall',
  'editorStumps',
  'editorStructures',
  'editorDetails',
]));
const BLOCKING_PROP_GLB_PREFIXES = Object.freeze(['plant_bush']);

/**
 * @param {string} propId — e.g. `nature-prop:tree_simple`
 * @returns {boolean} whether this prop stops a building from being placed on its tile
 */
export function isBlockingNatureProp(propId) {
  const entry = NATURE_PROP_CATALOG[propId];
  if (!entry) {
    throw new Error(`[naturePropCatalog] "${propId}" is not a nature prop of the catalog`);
  }
  return entry.tags.some((tag) => BLOCKING_PROP_CATEGORIES.has(tag))
    || BLOCKING_PROP_GLB_PREFIXES.some((prefix) => entry.glbName.startsWith(prefix));
}

/**
 * What a piece of nature on the grid is for the game. Nothing on the grid is decor (decor stands outside it): every prop of a map is a record of the hamlet,
 * of the building type that says what it is and what it holds, by kind of piece: a tree holds 100 wood; a rock holds stone, and the large ones iron, the tall
 * ones gold (the more massive the rock, the more it hides); a stone or a small rock only stone; any other piece nothing yet (ore and clay are to be tied to pieces).
 * The figures the game counts (the nature tab, the editor's total) are the sum of these, nothing else.
 */
const PROP_RECORDS = Object.freeze({
  tree: Object.freeze({ type: 'Tree-Chene', stocks: Object.freeze({ wood: 100 }) }),
  rockSmall: Object.freeze({ type: 'Boulder-001', stocks: Object.freeze({ rock: 50 }) }),
  rockLarge: Object.freeze({ type: 'Boulder-001', stocks: Object.freeze({ rock: 150, iron: 60 }) }),
  rockTall: Object.freeze({ type: 'Boulder-001', stocks: Object.freeze({ rock: 100, gold: 30 }) }),
  other: Object.freeze({ type: 'Nature-Piece', stocks: Object.freeze({}) }),
});

/** The kind of rock record each rock or stone category of the kit makes. */
const ROCK_RECORD_BY_CATEGORY = Object.freeze({
  editorRockSmall: 'rockSmall',
  editorRockLarge: 'rockLarge',
  editorRockTall: 'rockTall',
  editorStoneSmall: 'rockSmall',
  editorStoneLarge: 'rockSmall',
  editorStoneTall: 'rockSmall',
});

/**
 * @param {string} assetId a piece of a map (`nature:...` ground, `nature-prop:...` prop)
 * @returns {{ type: string, stocks: Readonly<Record<string, number>> } | null} the record the piece is on the grid, null for a piece of ground
 */
export function propRecordSpec(assetId) {
  if (!assetId.startsWith('nature-prop:')) return null;
  const entry = NATURE_PROP_CATALOG[assetId];
  if (!entry) {
    throw new Error(`[naturePropCatalog] "${assetId}" is not a nature prop of the catalog`);
  }
  if (entry.tags.includes('editorTrees')) return PROP_RECORDS.tree;
  const rockCategory = entry.tags.find((tag) => ROCK_RECORD_BY_CATEGORY[tag]);
  return rockCategory ? PROP_RECORDS[ROCK_RECORD_BY_CATEGORY[rockCategory]] : PROP_RECORDS.other;
}

/**
 * @param {string} categoryId a nature category of the editor (`editorTrees`, `editorRockLarge`, ...)
 * @returns {Readonly<Record<string, number>>} what one piece of that category holds when the hamlet is played (empty for a piece that holds nothing)
 */
export function categoryRecordStocks(categoryId) {
  if (categoryId === 'editorTrees') return PROP_RECORDS.tree.stocks;
  const rockRecord = ROCK_RECORD_BY_CATEGORY[categoryId];
  return rockRecord ? PROP_RECORDS[rockRecord].stocks : PROP_RECORDS.other.stocks;
}

/**
 * The props of a map that are records of the hamlet: one per tile (a second prop on the same tile adds no record of its own), each with its type and stocks. The
 * game gives each its record on the hamlet's first load; the editor adds up what they hold as the player places them.
 * @param {ReadonlyArray<{ assetId: string, x: number, y: number }>} pieces the pieces of a map
 * @returns {Array<{ piece: { assetId: string, x: number, y: number }, type: string, stocks: Readonly<Record<string, number>> }>}
 */
export function propsHoldingRecord(pieces) {
  const seen = new Set();
  const props = [];
  for (const piece of pieces) {
    const spec = propRecordSpec(piece.assetId);
    const tile = `${piece.x},${piece.y}`;
    if (spec === null || seen.has(tile)) continue;
    seen.add(tile);
    props.push({ piece, ...spec });
  }
  return props;
}

/** The pieces a new hamlet's nature is made of when it is generated at random (glb names of the Kenney kit). */
const SEEDED_TREE_GLBS = Object.freeze(['tree_default', 'tree_oak', 'tree_pineDefaultA', 'tree_pineTallA', 'tree_simple', 'tree_small']);
const SEEDED_ROCK_GLBS = Object.freeze(['rock_largeA', 'rock_smallA', 'rock_tallA', 'stone_largeA', 'stone_smallA']);

/**
 * @param {readonly string[]} glbNames
 * @returns {string[]} the prop ids, each checked against the catalog
 */
function seededPropIds(glbNames) {
  return glbNames.map((glbName) => {
    const propId = `nature-prop:${glbName}`;
    if (!NATURE_PROP_CATALOG[propId]) {
      throw new Error(`[naturePropCatalog] the seeded piece "${propId}" is not a prop of the Kenney kit`);
    }
    return propId;
  });
}

/** @returns {string[]} the trees a generated hamlet is planted with */
export function seededTreePropIds() {
  return seededPropIds(SEEDED_TREE_GLBS);
}

/** @returns {string[]} the rocks a generated hamlet is strewn with */
export function seededRockPropIds() {
  return seededPropIds(SEEDED_ROCK_GLBS);
}

/**
 * @param {string} propId
 * @returns {typeof NATURE_PROP_CATALOG[string] | undefined}
 */
export function getNaturePropCatalogEntry(propId) {
  return NATURE_PROP_CATALOG[propId];
}

/**
 * @param {string} propId — e.g. `nature-prop:tree_simple`
 * @returns {string}
 */
export function resolveNaturePropGlbName(propId) {
  const entry = getNaturePropCatalogEntry(propId);
  if (entry?.glbName) return entry.glbName;
  return propId.replace(/^nature-prop:/, '');
}
