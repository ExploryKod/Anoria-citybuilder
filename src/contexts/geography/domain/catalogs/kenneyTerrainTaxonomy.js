/**
 * Shared Kenney terrain folder taxonomy (Grass, Dirt, DarkDirt, Sand, Stone).
 *
 * ## Level 1 — `fill` vs `framed`
 *
 * - **fill** — the biome colour reaches the hex edges (continuous field).
 * - **framed** — another material forms a border; the biome does not reach all edges.
 *   Use `framed/by_{material}` (grass, dirt, darkdirt, sand, stone, rock, empty, …).
 *   Edge thickness is encoded in the filename when relevant (`thin_*`, `light_*`, …).
 *
 * There is no separate **islet** category: a patch surrounded by another colour is **framed**.
 *
 * ## Level 2 — objects on **fill** (mostly)
 *
 * When the biome fills to the edge but the tile carries props (trees, rocks, cars, …):
 *
 * - `fill/forest/{few|numerous|with-rock}`
 * - `fill/with-rock/`
 * - `fill/colline/`
 * - `fill/desert/…`
 * - `fill/urban/…`
 * - `fill/camp/…`
 * - `fill/patch/{material}/` — small inner patch of another terrain on a fill base
 *
 * Plain continuous tiles: `fill/plain_edges`, `fill/crenellated_edges`.
 *
 * Empty-centre silhouettes: `framed/by_empty/` or `framed/on_empty/`.
 */

/** @typedef {'fill' | 'framed' | 'silhouette'} TerrainLayoutKind */

/**
 * @param {string} categoryPath Path under biome/, without filename
 * @returns {TerrainLayoutKind}
 */
export function terrainLayoutKind(categoryPath) {
  if (!categoryPath || categoryPath === 'silhouette') return 'silhouette';
  const top = categoryPath.split('/')[0];
  if (top === 'fill') return 'fill';
  if (top === 'framed') return 'framed';
  return 'fill';
}

/**
 * Plain `fill/plain_edges` and `fill/crenellated_edges` are seamless fields;
 * any other `fill/…` path carries props or inner patches.
 *
 * @param {string} categoryPath
 */
export function isPlainFillCategory(categoryPath) {
  return categoryPath === 'fill/plain_edges'
    || categoryPath === 'fill/crenellated_edges'
    || categoryPath === 'fill/plain';
}

/**
 * @param {TerrainLayoutKind} layout
 * @param {string} categoryPath
 */
export function layoutToCatalogRole(layout, categoryPath) {
  if (
    layout === 'silhouette'
    || categoryPath.startsWith('framed/')
  ) {
    return 'framed';
  }
  if (layout === 'fill' && isPlainFillCategory(categoryPath)) {
    return 'fill';
  }
  if (layout === 'fill') {
    return 'prop';
  }
  return 'unknown';
}
