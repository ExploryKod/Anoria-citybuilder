/**
 * Kenney Hexagon Pack — Phaser atlas keys, URLs and gameplay frame mapping.
 *
 * Atlases live in `public/resources/kenney_hexagon-pack/Spritesheets/`.
 * Phaser loads them via `load.atlasXML(key, pngUrl, xmlUrl)` (Starling XML format).
 *
 * Frame names in XML include the `.png` suffix — use `kenneyFrameName()` when building from a stem.
 *
 * Map rendering policy: Kenney sprites are the visual source of truth. Only place hex tiles
 * that resolve here; never invent placeholders (e.g. no water hex — ocean is a flat background).
 *
 * Terrain frame picks come from `kenneyTerrainCatalog.json` (run `pnpm classify:kenney-hex`).
 * Grass, Dirt, DarkDirt, Sand, and Stone tiles are curated under `PNG/Tiles/Terrain/{Biome}/{category}/`.
 */

import terrainCatalog from './kenneyTerrainCatalog.json' with { type: 'json' };

/** Web path from site root (Vite `public/`). */
export const KENNEY_HEX_SPRITESHEET_BASE = '/resources/kenney_hexagon-pack/Spritesheets';

/** Kenney hex tile bounding box (pointy-top). */
export const KENNEY_HEX_TILE_WIDTH = 120;
export const KENNEY_HEX_TILE_HEIGHT = 140;

/** Default hex radius (centre → corner) for axial layout — half tile height. */
export const KENNEY_HEX_DEFAULT_RADIUS = KENNEY_HEX_TILE_HEIGHT / 2;

/** @typedef {'terrain' | 'buildings' | 'objects' | 'all'} KenneyHexAtlasId */

/** @type {Readonly<Record<KenneyHexAtlasId, { key: string, textureUrl: string, atlasUrl: string }>>} */
export const KENNEY_HEX_ATLASES = Object.freeze({
  terrain: Object.freeze({
    key: 'kenney-hex-terrain',
    textureUrl: `${KENNEY_HEX_SPRITESHEET_BASE}/hexagonTerrain_sheet.png`,
    atlasUrl: `${KENNEY_HEX_SPRITESHEET_BASE}/hexagonTerrain_sheet.xml`,
  }),
  buildings: Object.freeze({
    key: 'kenney-hex-buildings',
    textureUrl: `${KENNEY_HEX_SPRITESHEET_BASE}/hexagonBuildings_sheet.png`,
    atlasUrl: `${KENNEY_HEX_SPRITESHEET_BASE}/hexagonBuildings_sheet.xml`,
  }),
  objects: Object.freeze({
    key: 'kenney-hex-objects',
    textureUrl: `${KENNEY_HEX_SPRITESHEET_BASE}/hexagonObjects_sheet.png`,
    atlasUrl: `${KENNEY_HEX_SPRITESHEET_BASE}/hexagonObjects_sheet.xml`,
  }),
  all: Object.freeze({
    key: 'kenney-hex-all',
    textureUrl: `${KENNEY_HEX_SPRITESHEET_BASE}/hexagonAll_sheet.png`,
    atlasUrl: `${KENNEY_HEX_SPRITESHEET_BASE}/hexagonAll_sheet.xml`,
  }),
});

/** Default atlases for map scenes (avoid loading the 876 KB “all” sheet unless needed). */
export const KENNEY_HEX_MAP_ATLAS_IDS = Object.freeze(['terrain', 'buildings']);

/** Classified terrain catalog (auto-generated). */
export const KENNEY_TERRAIN_CATALOG = Object.freeze(terrainCatalog);

/**
 * @typedef {{ atlas: KenneyHexAtlasId, frame: string }} KenneyGameplaySprite
 */

const terrainFillFrames = terrainCatalog.gameplayFillDefaults;

/**
 * Gameplay terrain / entity keys → atlas + frame (frames include `.png` suffix).
 * Terrain keys use `fill` tiles from the classified catalog for continuous biomes.
 * @type {Readonly<Record<string, KenneyGameplaySprite>>}
 */
export const KENNEY_HEX_GAMEPLAY_SPRITES = Object.freeze({
  grassland: { atlas: 'terrain', frame: terrainFillFrames.grassland },
  coast: { atlas: 'terrain', frame: terrainFillFrames.coast },
  desert: { atlas: 'terrain', frame: terrainFillFrames.desert },
  hill: { atlas: 'terrain', frame: terrainFillFrames.hill },
  mountain: { atlas: 'terrain', frame: terrainFillFrames.mountain },
  forest: { atlas: 'terrain', frame: terrainFillFrames.forest },
  hamlet: { atlas: 'buildings', frame: 'medieval_cabin.png' },
  village: { atlas: 'buildings', frame: 'medieval_house.png' },
  capital: { atlas: 'buildings', frame: 'medieval_largeCastle.png' },
  port: { atlas: 'buildings', frame: 'mill_crane.png' },
  mine: { atlas: 'buildings', frame: 'medieval_mine.png' },
  farm: { atlas: 'buildings', frame: 'medieval_farm.png' },
  market: { atlas: 'buildings', frame: 'medieval_archery.png' },
});

/**
 * @param {string} frame e.g. `grass_06.png`
 */
export function getKenneyTerrainTileMeta(frame) {
  return terrainCatalog.terrain.find((entry) => entry.frame === frame)
    ?? terrainCatalog.grass?.tiles?.find((entry) => entry.frame === frame)
    ?? terrainCatalog.dirt?.tiles?.find((entry) => entry.frame === frame)
    ?? terrainCatalog.darkDirt?.tiles?.find((entry) => entry.frame === frame)
    ?? terrainCatalog.sand?.tiles?.find((entry) => entry.frame === frame)
    ?? terrainCatalog.stone?.tiles?.find((entry) => entry.frame === frame)
    ?? null;
}

/**
 * @param {string} stem e.g. `grass_05`
 */
export function getGrassTileMeta(stem) {
  const frame = kenneyFrameName(stem);
  return terrainCatalog.grass?.tiles?.find((entry) => entry.frame === frame) ?? null;
}

/**
 * @param {string} frameOrId Atlas frame (`dirt_06.png`) or descriptive id/file stem
 */
export function getDirtTileMeta(frameOrId) {
  const frame = frameOrId.endsWith('.png') ? frameOrId : `${frameOrId}.png`;
  return terrainCatalog.dirt?.tiles?.find(
    (entry) => entry.frame === frame
      || entry.file === frame
      || entry.id === frameOrId
      || entry.id === frame.replace(/\.png$/i, '')
  ) ?? null;
}

/**
 * Normalise a Kenney frame stem to the XML SubTexture name.
 * @param {string} frameStem e.g. `grass_01` or `grass_01.png`
 * @returns {string}
 */
export function kenneyFrameName(frameStem) {
  if (!frameStem) return '';
  return frameStem.endsWith('.png') ? frameStem : `${frameStem}.png`;
}

/**
 * @param {string} gameplayKey
 * @returns {KenneyGameplaySprite | null}
 */
export function resolveKenneyGameplaySprite(gameplayKey) {
  return KENNEY_HEX_GAMEPLAY_SPRITES[gameplayKey] ?? null;
}

/**
 * Texture key + frame for `scene.add.image(x, y, textureKey, frame)`.
 * @param {string} gameplayKey
 * @returns {{ textureKey: string, frame: string } | null}
 */
export function resolveKenneyPhaserFrame(gameplayKey) {
  const sprite = resolveKenneyGameplaySprite(gameplayKey);
  if (!sprite) return null;
  const atlas = KENNEY_HEX_ATLASES[sprite.atlas];
  if (!atlas) return null;
  return {
    textureKey: atlas.key,
    frame: kenneyFrameName(sprite.frame),
  };
}

/**
 * @param {KenneyHexAtlasId} atlasId
 */
export function getKenneyAtlas(atlasId) {
  return KENNEY_HEX_ATLASES[atlasId] ?? null;
}
