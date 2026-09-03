import {
  KENNEY_HEX_ATLASES,
  KENNEY_HEX_MAP_ATLAS_IDS,
  resolveKenneyPhaserFrame,
} from '../../../composition/geographyCatalog.js';

/**
 * Queue Kenney hex XML atlases on a Phaser loader.
 *
 * Uses `atlasXML` (Starling / TexturePacker XML) — the PNG path is passed explicitly,
 * so it works even when tools expect a local `sprites.png` name in the XML header.
 *
 * @param {import('phaser').Loader.LoaderPlugin} loader
 * @param {{ atlasIds?: ReadonlyArray<import('../../../contexts/geography/domain/catalogs/HexAssetCatalog.js').KenneyHexAtlasId> }} [options]
 */
export function loadKenneyHexAtlases(loader, options = {}) {
  const atlasIds = options.atlasIds ?? KENNEY_HEX_MAP_ATLAS_IDS;

  for (const atlasId of atlasIds) {
    const atlas = KENNEY_HEX_ATLASES[atlasId];
    if (!atlas) {
      console.warn(`[loadKenneyHexAtlases] Unknown atlas id: ${atlasId}`);
      continue;
    }
    loader.atlasXML(atlas.key, atlas.textureUrl, atlas.atlasUrl);
  }
}

/**
 * @param {import('phaser').Textures.TextureManager} textures
 * @param {import('../../../contexts/geography/domain/catalogs/HexAssetCatalog.js').KenneyHexAtlasId} atlasId
 * @returns {boolean}
 */
export function isKenneyAtlasLoaded(textures, atlasId) {
  const atlas = KENNEY_HEX_ATLASES[atlasId];
  return Boolean(atlas && textures.exists(atlas.key));
}

/**
 * @param {import('phaser').Textures.TextureManager} textures
 * @param {string} gameplayKey
 * @returns {boolean}
 */
export function hasKenneyGameplayFrame(textures, gameplayKey) {
  const resolved = resolveKenneyPhaserFrame(gameplayKey);
  if (!resolved) return false;
  return textures.exists(resolved.textureKey) && textures.get(resolved.textureKey).has(resolved.frame);
}
