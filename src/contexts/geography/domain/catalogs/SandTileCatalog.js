/**
 * Curated Kenney Sand tiles — see `kenneyTerrainTaxonomy.js`.
 */

import { layoutToCatalogRole, terrainLayoutKind } from './kenneyTerrainTaxonomy.js';

/**
 * @typedef {{ file: string, frame: string, category: string }} CuratedTileEntry
 */

/** @type {ReadonlyArray<CuratedTileEntry>} */
export const SAND_TILE_ENTRIES = Object.freeze([
  { file: 'thin_sand_edge_on_empty.png', frame: 'sand_01.png', category: 'framed/by_empty' },
  { file: 'plain_sand_fill.png', frame: 'sand_02.png', category: 'fill/plain_edges' },
  { file: 'plain_sand_fill_alt.png', frame: 'sand_07.png', category: 'fill/plain_edges' },
  { file: 'raised_sand_block.png', frame: 'sand_19.png', category: 'fill/colline' },
  { file: 'large_grey_rock_on_sand.png', frame: 'sand_04.png', category: 'fill/with-rock' },
  { file: 'two_brown_rocks_on_sand.png', frame: 'sand_16.png', category: 'fill/with-rock' },
  { file: 'three_brown_rocks_on_sand.png', frame: 'sand_17.png', category: 'fill/with-rock' },
  { file: 'grass_islet_on_sand.png', frame: 'sand_03.png', category: 'fill/patch/grass' },
  { file: 'dirt_patch_on_sand.png', frame: 'sand_06.png', category: 'fill/patch/dirt' },
  { file: 'two_cacti_on_sand_fill.png', frame: 'sand_12.png', category: 'fill/desert/cacti/few' },
  { file: 'two_cacti_on_sand.png', frame: 'sand_13.png', category: 'fill/desert/cacti/few' },
  { file: 'five_cacti_on_sand.png', frame: 'sand_14.png', category: 'fill/desert/cacti/numerous' },
  { file: 'cacti_and_skull_on_sand.png', frame: 'sand_15.png', category: 'fill/desert/mixed' },
  { file: 'rocks_and_cactus_on_sand.png', frame: 'sand_18.png', category: 'fill/desert/mixed' },
  { file: 'dirt_waves_edges_on_sand.png', frame: 'dirt_05.png', category: 'framed/by_darkdirt' },
  { file: 'darkdirt_edges_on_sand.png', frame: 'mars_05.png', category: 'framed/by_dirt' },
  { file: 'thin_darkdirt_waves_edges_on_sand.png', frame: 'sand_10.png', category: 'framed/by_dirt' },
  { file: 'thin_lightdirt_waves_edges_on_sand.png', frame: 'sand_08.png', category: 'framed/by_dirt' },
  { file: 'thin_grass_edges_on_sand.png', frame: 'sand_09.png', category: 'framed/by_grass' },
  { file: 'stone_edges_on_sand.png', frame: 'stone_05.png', category: 'framed/by_stone' },
  { file: 'thin_stone_edges_on_sand.png', frame: 'sand_11.png', category: 'framed/by_stone' },
]);

/** @type {Readonly<Record<string, CuratedTileEntry>>} */
export const SAND_TILES = Object.freeze(
  Object.fromEntries(SAND_TILE_ENTRIES.map((entry) => [entry.file, entry]))
);

/** @type {Readonly<Record<string, string>>} */
export const SAND_ATLAS_FRAME_BY_FILE = Object.freeze(
  Object.fromEntries(SAND_TILE_ENTRIES.map((entry) => [entry.file, entry.frame]))
);

/** @type {Readonly<Record<string, string>>} */
export const SAND_GAMEPLAY_FRAMES = Object.freeze({
  coast: 'sand_02',
  coastAlt: 'sand_07',
});

/**
 * @param {string} fileName
 */
export function resolveSandStemFromFile(fileName) {
  const entry = SAND_TILES[fileName];
  if (entry) return entry.file.replace(/\.png$/i, '');

  const byFrame = SAND_TILE_ENTRIES.find((item) => item.frame === fileName);
  return byFrame?.file.replace(/\.png$/i, '') ?? null;
}

/**
 * @param {string} fileName
 */
export function resolveSandAtlasFrame(fileName) {
  return SAND_ATLAS_FRAME_BY_FILE[fileName] ?? null;
}

/**
 * @param {string} categoryPath
 */
export function sandCategoryKind(categoryPath) {
  return terrainLayoutKind(categoryPath);
}

/**
 * @param {string} categoryPath
 */
export function sandKindToCatalogRole(categoryPath) {
  return layoutToCatalogRole(terrainLayoutKind(categoryPath), categoryPath);
}

/**
 * @param {string} packRelativePath
 */
export function parseSandTilePath(packRelativePath) {
  const marker = 'PNG/Tiles/Terrain/Sand/';
  const index = packRelativePath.indexOf(marker);
  if (index === -1) return null;

  const underSand = packRelativePath.slice(index + marker.length);
  const slash = underSand.lastIndexOf('/');
  const category = slash === -1 ? '' : underSand.slice(0, slash);
  const fileName = slash === -1 ? underSand : underSand.slice(slash + 1);
  const entry = SAND_TILES[fileName];
  if (!entry) return null;

  const stem = entry.frame.replace(/\.png$/i, '');

  return {
    id: fileName.replace(/\.png$/i, ''),
    frame: entry.frame,
    file: fileName,
    stem,
    biome: 'Sand',
    category,
    kind: sandCategoryKind(category),
    role: sandKindToCatalogRole(category),
    path: packRelativePath,
  };
}

/**
 * @param {ReadonlyArray<{ file: string, category: string }>} entries
 */
export function indexSandByCategory(entries) {
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
