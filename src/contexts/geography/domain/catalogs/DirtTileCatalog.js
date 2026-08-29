/**
 * Curated Kenney Dirt tiles — see `kenneyTerrainTaxonomy.js`.
 *
 * Each entry: descriptive filename on disk → Phaser atlas frame + folder category.
 */

import { layoutToCatalogRole, terrainLayoutKind } from './kenneyTerrainTaxonomy.js';

/**
 * @typedef {{ file: string, frame: string, category: string }} CuratedTileEntry
 */

/** @type {ReadonlyArray<CuratedTileEntry>} */
export const DIRT_TILE_ENTRIES = Object.freeze([
  { file: 'thin_darkdirt_edge_on_empty.png', frame: 'dirt_01.png', category: 'framed/by_empty' },
  { file: 'light_dirt_edges_on_darkdirt.png', frame: 'dirt_04.png', category: 'framed/by_darkdirt' },
  { file: 'plain_dirt_fill_06.png', frame: 'dirt_06.png', category: 'fill/plain_edges' },
  { file: 'thin_grass_edges_on_dirt.png', frame: 'dirt_07.png', category: 'framed/by_grass' },
  { file: 'edged_dirt_scallop_08.png', frame: 'dirt_08.png', category: 'framed/by_sand' },
  { file: 'thin_darkdirt_edges_on_dirt.png', frame: 'dirt_09.png', category: 'framed/by_darkdirt' },
  { file: 'thin_stone_edges_on_dirt.png', frame: 'dirt_10.png', category: 'framed/by_stone' },
  { file: 'sparse_pines_on_dirt_11.png', frame: 'dirt_11.png', category: 'fill/forest/few' },
  { file: 'few_pines_on_dirt_12.png', frame: 'dirt_12.png', category: 'fill/forest/few' },
  { file: 'dense_pines_on_dirt_13.png', frame: 'dirt_13.png', category: 'fill/forest/numerous' },
  { file: 'pine_ring_on_dirt_14.png', frame: 'dirt_14.png', category: 'fill/forest/numerous' },
  { file: 'small_rocks_on_dirt_15.png', frame: 'dirt_15.png', category: 'fill/with-rock' },
  { file: 'rock_cluster_on_dirt_16.png', frame: 'dirt_16.png', category: 'fill/with-rock' },
  { file: 'rocky_hill_with_pines_17.png', frame: 'dirt_17.png', category: 'fill/colline' },
  { file: 'rocky_hill_with_trees_18.png', frame: 'dirt_18.png', category: 'fill/colline' },
  { file: 'crenellated_dirt_fill_19.png', frame: 'dirt_19.png', category: 'fill/crenellated_edges' },
  { file: 'sand_waves_edges_on_darkdirt.png', frame: 'sand_05.png', category: 'framed/by_sand' },
  { file: 'stone_edges_on_darkdirt.png', frame: 'stone_04.png', category: 'framed/by_stone' },
  { file: 'stone_edges_on_lightdirt.png', frame: 'stone_06.png', category: 'framed/by_stone' },
]);

/** @type {Readonly<Record<string, CuratedTileEntry>>} */
export const DIRT_TILES = Object.freeze(
  Object.fromEntries(DIRT_TILE_ENTRIES.map((entry) => [entry.file, entry]))
);

/** @type {Readonly<Record<string, string>>} */
export const DIRT_ATLAS_FRAME_BY_FILE = Object.freeze(
  Object.fromEntries(DIRT_TILE_ENTRIES.map((entry) => [entry.file, entry.frame]))
);

/** @type {Readonly<Record<string, string>>} */
export const DIRT_GAMEPLAY_FRAMES = Object.freeze({
  hill: 'dirt_06',
  hillAlt: 'dirt_19',
  dirtForest: 'dirt_13',
  dirtForestFew: 'dirt_11',
  rockyHill: 'dirt_17',
});

/** @type {Readonly<Record<string, string>>} */
export const DIRT_FRAME_TO_FILE = Object.freeze(
  Object.fromEntries(DIRT_TILE_ENTRIES.map((entry) => [entry.frame, entry.file]))
);

/**
 * @param {string} fileName
 */
export function resolveDirtStemFromFile(fileName) {
  const entry = DIRT_TILES[fileName];
  if (entry) return entry.file.replace(/\.png$/i, '');

  const byFrame = DIRT_TILE_ENTRIES.find((item) => item.frame === fileName);
  return byFrame?.file.replace(/\.png$/i, '') ?? null;
}

/**
 * @param {string} fileName
 */
export function resolveDirtAtlasFrame(fileName) {
  return DIRT_ATLAS_FRAME_BY_FILE[fileName] ?? null;
}

/**
 * @param {string} categoryPath
 */
export function dirtCategoryKind(categoryPath) {
  return terrainLayoutKind(categoryPath);
}

/**
 * @param {string} categoryPath
 */
export function dirtKindToCatalogRole(categoryPath) {
  return layoutToCatalogRole(terrainLayoutKind(categoryPath), categoryPath);
}

/**
 * @param {string} packRelativePath
 */
export function parseDirtTilePath(packRelativePath) {
  const marker = 'PNG/Tiles/Terrain/Dirt/';
  const index = packRelativePath.indexOf(marker);
  if (index === -1) return null;

  const underDirt = packRelativePath.slice(index + marker.length);
  const slash = underDirt.lastIndexOf('/');
  const category = slash === -1 ? '' : underDirt.slice(0, slash);
  const fileName = slash === -1 ? underDirt : underDirt.slice(slash + 1);
  const entry = DIRT_TILES[fileName];
  if (!entry) return null;

  const stem = entry.frame.replace(/\.png$/i, '');

  return {
    id: fileName.replace(/\.png$/i, ''),
    frame: entry.frame,
    file: fileName,
    stem,
    biome: 'Dirt',
    category,
    kind: dirtCategoryKind(category),
    role: dirtKindToCatalogRole(category),
    path: packRelativePath,
  };
}

/**
 * @param {ReadonlyArray<{ file: string, category: string }>} entries
 */
export function indexDirtByCategory(entries) {
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
