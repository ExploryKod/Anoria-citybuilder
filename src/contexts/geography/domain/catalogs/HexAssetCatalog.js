/**
 * Kenney Hexagon Pack — Phaser atlas keys, URLs and gameplay frame mapping.
 *
 * Atlases live in `public/resources/kenney_hexagon-pack/Spritesheets/`.
 * Phaser loads them via `load.atlasXML(key, pngUrl, xmlUrl)` (Starling XML format).
 *
 * Frame names in XML include the `.png` suffix — use `kenneyFrameName()` when building from a stem.
 */

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

/**
 * @typedef {{ atlas: KenneyHexAtlasId, frame: string }} KenneyGameplaySprite
 */

/**
 * Gameplay terrain / entity keys → atlas + frame (frames include `.png` suffix).
 * @type {Readonly<Record<string, KenneyGameplaySprite>>}
 */
export const KENNEY_HEX_GAMEPLAY_SPRITES = Object.freeze({
  grassland: { atlas: 'terrain', frame: 'grass_01.png' },
  coast: { atlas: 'terrain', frame: 'sand_01.png' },
  desert: { atlas: 'terrain', frame: 'mars_01.png' },
  hill: { atlas: 'terrain', frame: 'dirt_01.png' },
  mountain: { atlas: 'terrain', frame: 'stone_01.png' },
  forest: { atlas: 'terrain', frame: 'grass_03.png' },
  hamlet: { atlas: 'buildings', frame: 'medieval_cabin.png' },
  village: { atlas: 'buildings', frame: 'medieval_house.png' },
  capital: { atlas: 'buildings', frame: 'medieval_largeCastle.png' },
  port: { atlas: 'buildings', frame: 'mill_crane.png' },
  mine: { atlas: 'buildings', frame: 'medieval_mine.png' },
  farm: { atlas: 'buildings', frame: 'medieval_farm.png' },
  market: { atlas: 'buildings', frame: 'medieval_archery.png' },
});

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
