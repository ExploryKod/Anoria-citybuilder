/**
 * Curated Kenney DarkDirt tiles (atlas frames `mars_XX`) — see `kenneyTerrainTaxonomy.js`.
 */

import { layoutToCatalogRole, terrainLayoutKind } from './kenneyTerrainTaxonomy.js';

/**
 * @typedef {{ file: string, frame: string, category: string }} CuratedTileEntry
 */

/** @type {ReadonlyArray<CuratedTileEntry>} */
export const DARK_DIRT_TILE_ENTRIES = Object.freeze([
  { file: 'dirt_with_numerous_purple_cubes.png', frame: 'mars_13.png', category: 'fill/by_cubes' },
  { file: 'dirt_with_purple_cubes.png', frame: 'mars_12.png', category: 'fill/by_cubes' },
  { file: 'dirt_with_lamps.png', frame: 'mars_16.png', category: 'fill/by_lamps' },
  { file: 'mars_15.png', frame: 'mars_15.png', category: 'fill/by_rocks' },
  { file: 'mars_17.png', frame: 'mars_17.png', category: 'fill/by_rocks' },
  { file: 'mars_18.png', frame: 'mars_18.png', category: 'fill/by_rocks' },
  { file: 'mars_19.png', frame: 'mars_19.png', category: 'fill/by_rocks' },
  { file: 'mars_filled_by_blue_rocks.png', frame: 'mars_14.png', category: 'fill/by_rocks' },
  { file: 'mars_02.png', frame: 'mars_02.png', category: 'fill/plain' },
  { file: 'mars_07.png', frame: 'mars_07.png', category: 'fill/plain' },
  { file: 'mars_09.png', frame: 'mars_09.png', category: 'fill/plain' },
  { file: 'mars_06.png', frame: 'mars_06.png', category: 'framed/by_darkdirt' },
  { file: 'mars_08.png', frame: 'mars_08.png', category: 'framed/by_grass' },
  { file: 'thin_sand_edges_on_darkdirt.png', frame: 'mars_10.png', category: 'framed/by_sand' },
  { file: 'thin_stone_edges_on_darkdirt.png', frame: 'mars_11.png', category: 'framed/by_stone' },
  { file: 'mars_01.png', frame: 'mars_01.png', category: 'framed/on_empty' },
]);

/** @type {Readonly<Record<string, CuratedTileEntry>>} */
export const DARK_DIRT_TILES = Object.freeze(
  Object.fromEntries(DARK_DIRT_TILE_ENTRIES.map((entry) => [entry.file, entry]))
);

/** @type {Readonly<Record<string, string>>} */
export const DARK_DIRT_ATLAS_FRAME_BY_FILE = Object.freeze(
  Object.fromEntries(DARK_DIRT_TILE_ENTRIES.map((entry) => [entry.file, entry.frame]))
);

/** @type {Readonly<Record<string, string>>} */
export const DARK_DIRT_GAMEPLAY_FRAMES = Object.freeze({
  desert: 'mars_06',
  desertAlt: 'mars_07',
  darkDirtPlain: 'mars_02',
});

/**
 * @param {string} fileName
 */
export function resolveDarkDirtStemFromFile(fileName) {
  const entry = DARK_DIRT_TILES[fileName];
  if (entry) return entry.file.replace(/\.png$/i, '');

  const byFrame = DARK_DIRT_TILE_ENTRIES.find((item) => item.frame === fileName);
  return byFrame?.file.replace(/\.png$/i, '') ?? null;
}

/**
 * @param {string} categoryPath
 */
export function darkDirtCategoryKind(categoryPath) {
  return terrainLayoutKind(categoryPath);
}

/**
 * @param {string} categoryPath
 */
export function darkDirtKindToCatalogRole(categoryPath) {
  return layoutToCatalogRole(terrainLayoutKind(categoryPath), categoryPath);
}

/**
 * @param {string} packRelativePath
 */
export function parseDarkDirtTilePath(packRelativePath) {
  const marker = 'PNG/Tiles/Terrain/DarkDirt/';
  const index = packRelativePath.indexOf(marker);
  if (index === -1) return null;

  const underBiome = packRelativePath.slice(index + marker.length);
  const slash = underBiome.lastIndexOf('/');
  const category = slash === -1 ? '' : underBiome.slice(0, slash);
  const fileName = slash === -1 ? underBiome : underBiome.slice(slash + 1);
  const entry = DARK_DIRT_TILES[fileName];
  if (!entry) return null;

  const stem = entry.frame.replace(/\.png$/i, '');

  return {
    id: fileName.replace(/\.png$/i, ''),
    frame: entry.frame,
    file: fileName,
    stem,
    biome: 'DarkDirt',
    category,
    kind: darkDirtCategoryKind(category),
    role: darkDirtKindToCatalogRole(category),
    path: packRelativePath,
  };
}

/**
 * @param {ReadonlyArray<{ file: string, category: string }>} entries
 */
export function indexDarkDirtByCategory(entries) {
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
