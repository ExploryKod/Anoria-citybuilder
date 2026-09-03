/**
 * Static geography catalog for presentation (no getOrCreate) — Kenney hex
 * atlas / world-map declarative data. Pure catalogs, no context needed.
 */
export {
  KENNEY_HEX_SPRITESHEET_BASE,
  KENNEY_HEX_TILE_WIDTH,
  KENNEY_HEX_TILE_HEIGHT,
  KENNEY_HEX_DEFAULT_RADIUS,
  KENNEY_HEX_ATLASES,
  KENNEY_HEX_MAP_ATLAS_IDS,
  KENNEY_TERRAIN_CATALOG,
  KENNEY_HEX_GAMEPLAY_SPRITES,
  getKenneyTerrainTileMeta,
  getGrassTileMeta,
  getDirtTileMeta,
  kenneyFrameName,
  resolveKenneyGameplaySprite,
  resolveKenneyPhaserFrame,
  getKenneyAtlas,
} from '../contexts/geography/domain/catalogs/HexAssetCatalog.js';

export {
  WORLD_MAP_HEX_SIZE,
  WORLD_MAP_LAND_TILES,
  WORLD_MAP_LAND_HEX_KEYS,
  isWorldMapLandHex,
  isWorldMapShorelineHex,
} from '../contexts/geography/domain/world/worldMapDefinition.js';
