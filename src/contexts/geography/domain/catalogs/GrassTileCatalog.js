/**
 * Curated Kenney Grass tiles — see `kenneyTerrainTaxonomy.js`.
 */

import { layoutToCatalogRole, terrainLayoutKind } from './kenneyTerrainTaxonomy.js';

/**
 * @typedef {{ file: string, frame: string, category: string }} CuratedTileEntry
 */

/** @type {ReadonlyArray<CuratedTileEntry>} */
export const GRASS_TILE_ENTRIES = Object.freeze([
  { file: 'grass_01.png', frame: 'grass_01.png', category: 'fill/with-rock' },
  { file: 'grass_02.png', frame: 'grass_02.png', category: 'fill/patch/dirt' },
  { file: 'grass_03.png', frame: 'grass_03.png', category: 'fill/patch/sand' },
  { file: 'grass_04.png', frame: 'grass_04.png', category: 'fill/patch/dirt' },
  { file: 'grass_05.png', frame: 'grass_05.png', category: 'fill/plain_edges' },
  { file: 'grass_07.png', frame: 'grass_07.png', category: 'framed/by_sand' },
  { file: 'grass_10.png', frame: 'grass_10.png', category: 'fill/forest/few' },
  { file: 'grass_11.png', frame: 'grass_11.png', category: 'fill/forest/few' },
  { file: 'grass_12.png', frame: 'grass_12.png', category: 'fill/forest/numerous' },
  { file: 'grass_13.png', frame: 'grass_13.png', category: 'fill/forest/numerous' },
  { file: 'grass_14.png', frame: 'grass_14.png', category: 'fill/forest/with-rock' },
  { file: 'grass_15.png', frame: 'grass_15.png', category: 'fill/forest/with-rock' },
  { file: 'grass_16.png', frame: 'grass_16.png', category: 'fill/forest/with-rock' },
  { file: 'grass_17.png', frame: 'grass_17.png', category: 'fill/colline' },
  { file: 'grass_18.png', frame: 'grass_18.png', category: 'framed/by_empty' },
  { file: 'grass_19.png', frame: 'grass_19.png', category: 'fill/crenellated_edges' },
  { file: 'darkdirt_edges_on_grass.png', frame: 'mars_03.png', category: 'framed/by_dirt' },
  { file: 'dirt_edges_on_grass.png', frame: 'dirt_02.png', category: 'framed/by_dirt' },
  { file: 'thin_dirt_on_grass.png', frame: 'grass_06.png', category: 'framed/by_dirt' },
  { file: 'thin_dirt_on_grass_v2.png', frame: 'grass_08.png', category: 'framed/by_dirt' },
  { file: 'stone_edges_on_grass.png', frame: 'stone_03.png', category: 'framed/by_stone' },
  { file: 'thin_stone_edges_on_grass.png', frame: 'grass_09.png', category: 'framed/by_stone' },
]);

/** @type {Readonly<Record<string, CuratedTileEntry>>} */
export const GRASS_TILES = Object.freeze(
  Object.fromEntries(GRASS_TILE_ENTRIES.map((entry) => [entry.file, entry]))
);

/** @type {Readonly<Record<string, string>>} */
export const GRASS_GAMEPLAY_FRAMES = Object.freeze({
  grassland: 'grass_05',
  grasslandAlt: 'grass_19',
  forest: 'grass_12',
  forestFew: 'grass_10',
  forestWithRock: 'grass_14',
  hillAccent: 'grass_17',
});

/**
 * @param {string} fileName
 */
export function resolveGrassStemFromFile(fileName) {
  const entry = GRASS_TILES[fileName];
  if (entry) return entry.frame.replace(/\.png$/i, '');

  const byFrame = GRASS_TILE_ENTRIES.find((item) => item.frame === fileName);
  return byFrame?.frame.replace(/\.png$/i, '') ?? null;
}

/**
 * @param {string} categoryPath
 */
export function grassCategoryKind(categoryPath) {
  return terrainLayoutKind(categoryPath);
}

/**
 * @param {string} categoryPath
 */
export function grassKindToCatalogRole(categoryPath) {
  return layoutToCatalogRole(terrainLayoutKind(categoryPath), categoryPath);
}

/**
 * @param {string} packRelativePath
 */
export function parseGrassTilePath(packRelativePath) {
  const marker = 'PNG/Tiles/Terrain/Grass/';
  const index = packRelativePath.indexOf(marker);
  if (index === -1) return null;

  const underGrass = packRelativePath.slice(index + marker.length);
  const slash = underGrass.lastIndexOf('/');
  if (slash === -1) return null;

  const fileName = underGrass.slice(slash + 1);
  const category = underGrass.slice(0, slash);
  const entry = GRASS_TILES[fileName];
  if (!entry) return null;

  const stem = entry.frame.replace(/\.png$/i, '');

  return {
    frame: entry.frame,
    stem,
    biome: 'Grass',
    category,
    kind: grassCategoryKind(category),
    role: grassKindToCatalogRole(category),
    path: packRelativePath,
  };
}

/**
 * @param {ReadonlyArray<{ stem: string, category: string }>} entries
 */
export function indexGrassByCategory(entries) {
  /** @type {Record<string, string[]>} */
  const byCategory = {};
  for (const entry of entries) {
    const list = byCategory[entry.category] ?? [];
    list.push(`${entry.stem}.png`);
    byCategory[entry.category] = list;
  }
  for (const key of Object.keys(byCategory)) {
    byCategory[key].sort();
  }
  return byCategory;
}
