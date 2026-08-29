/**
 * Curated Kenney Stone tiles — see `kenneyTerrainTaxonomy.js`.
 */

import { layoutToCatalogRole, terrainLayoutKind } from './kenneyTerrainTaxonomy.js';

/**
 * @typedef {{ file: string, frame: string, category: string }} CuratedTileEntry
 */

/** @type {ReadonlyArray<CuratedTileEntry>} */
export const STONE_TILE_ENTRIES = Object.freeze([
  { file: 'thin_stone_edge_on_empty.png', frame: 'stone_01.png', category: 'framed/by_empty' },
  { file: 'plain_stone_fill.png', frame: 'stone_02.png', category: 'fill/plain' },
  { file: 'plain_stone_fill_alt.png', frame: 'stone_07.png', category: 'fill/plain' },
  { file: 'two_streetlamps_on_stone.png', frame: 'stone_14.png', category: 'fill/urban/lamps' },
  { file: 'darkdirt_edges_waves_on_stone.png', frame: 'mars_04.png', category: 'framed/by_dirt' },
  { file: 'dirt_edges_on_stone.png', frame: 'dirt_03.png', category: 'framed/by_dirt' },
  { file: 'thin_dirt_edges_on_stone_v1.png', frame: 'stone_11.png', category: 'framed/by_dirt' },
  { file: 'thin_dirt_edges_on_stone_v2.png', frame: 'stone_09.png', category: 'framed/by_dirt' },
  { file: 'thin_grass_edges_on_stone.png', frame: 'stone_08.png', category: 'framed/by_grass' },
  { file: 'thin_sand_edges_on_stone.png', frame: 'stone_10.png', category: 'framed/by_sand' },
  { file: 'few_trees_on_stone.png', frame: 'stone_12.png', category: 'fill/forest' },
  { file: 'three_trees_on_stone.png', frame: 'stone_13.png', category: 'fill/forest' },
  { file: 'fountain_on_stone.png', frame: 'stone_16.png', category: 'fill/urban/fountain' },
  { file: 'fountain_with_trees_on_stone.png', frame: 'stone_17.png', category: 'fill/urban/fountain' },
  { file: 'parking_lot_cars_on_stone.png', frame: 'stone_19.png', category: 'fill/urban/parking' },
  { file: 'plaza_trees_blocks_on_stone.png', frame: 'stone_15.png', category: 'fill/urban/plaza' },
  { file: 'camp_car_trees_on_stone.png', frame: 'stone_18.png', category: 'fill/camp' },
]);

/** @type {Readonly<Record<string, CuratedTileEntry>>} */
export const STONE_TILES = Object.freeze(
  Object.fromEntries(STONE_TILE_ENTRIES.map((entry) => [entry.file, entry]))
);

/** @type {Readonly<Record<string, string>>} */
export const STONE_ATLAS_FRAME_BY_FILE = Object.freeze(
  Object.fromEntries(STONE_TILE_ENTRIES.map((entry) => [entry.file, entry.frame]))
);

/** @type {Readonly<Record<string, string>>} */
export const STONE_GAMEPLAY_FRAMES = Object.freeze({
  mountain: 'stone_02',
  mountainAlt: 'stone_07',
  paved: 'stone_14',
});

/**
 * @param {string} fileName
 */
export function resolveStoneStemFromFile(fileName) {
  const entry = STONE_TILES[fileName];
  if (entry) return entry.file.replace(/\.png$/i, '');

  const byFrame = STONE_TILE_ENTRIES.find((item) => item.frame === fileName);
  return byFrame?.file.replace(/\.png$/i, '') ?? null;
}

/**
 * @param {string} fileName
 */
export function resolveStoneAtlasFrame(fileName) {
  return STONE_ATLAS_FRAME_BY_FILE[fileName] ?? null;
}

/**
 * @param {string} categoryPath
 */
export function stoneCategoryKind(categoryPath) {
  return terrainLayoutKind(categoryPath);
}

/**
 * @param {string} categoryPath
 */
export function stoneKindToCatalogRole(categoryPath) {
  return layoutToCatalogRole(terrainLayoutKind(categoryPath), categoryPath);
}

/**
 * @param {string} packRelativePath
 */
export function parseStoneTilePath(packRelativePath) {
  const marker = 'PNG/Tiles/Terrain/Stone/';
  const index = packRelativePath.indexOf(marker);
  if (index === -1) return null;

  const underStone = packRelativePath.slice(index + marker.length);
  const slash = underStone.lastIndexOf('/');
  const category = slash === -1 ? '' : underStone.slice(0, slash);
  const fileName = slash === -1 ? underStone : underStone.slice(slash + 1);
  const entry = STONE_TILES[fileName];
  if (!entry) return null;

  const stem = entry.frame.replace(/\.png$/i, '');

  return {
    id: fileName.replace(/\.png$/i, ''),
    frame: entry.frame,
    file: fileName,
    stem,
    biome: 'Stone',
    category,
    kind: stoneCategoryKind(category),
    role: stoneKindToCatalogRole(category),
    path: packRelativePath,
  };
}

/**
 * @param {ReadonlyArray<{ file: string, category: string }>} entries
 */
export function indexStoneByCategory(entries) {
  /** @type {Record<string, string[]>} */
  const byCategory = {};
  for (const entry of entries) {
    const list = byCategory[entry.category] ?? [];
    list.push(entry.file);
    byCategory[entry.category] = list;
  }
  for (const key of Object.keys(byCategory)) {
    byCategory[key].sort();
  }
  return byCategory;
}
