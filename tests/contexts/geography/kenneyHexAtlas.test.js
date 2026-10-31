import { describe, expect, test } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  KENNEY_HEX_ATLASES,
  KENNEY_HEX_GAMEPLAY_SPRITES,
  KENNEY_TERRAIN_CATALOG,
  getKenneyTerrainTileMeta,
  kenneyFrameName,
  resolveKenneyAtlasFrame,
} from '../../../src/contexts/geography/domain/catalogs/HexAssetCatalog.js';
import { verifyKenneyHexAtlasFiles } from '../../../scripts/verifyKenneyHexAtlases.js';

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../public');

describe('Kenney hex atlases', () => {
  test('PNG and XML pairs exist on disk with valid imagePath', () => {
    const result = verifyKenneyHexAtlasFiles(publicRoot);
    if (!result.ok) {
      throw new Error(result.errors.join('\n'));
    }
    expect(result.ok).toBe(true);
  });

  test('resolveKenneyAtlasFrame maps gameplay keys to an atlas and a frame', () => {
    const grass = resolveKenneyAtlasFrame('grassland');
    expect(grass).toEqual({
      atlasId: 'terrain',
      frame: KENNEY_TERRAIN_CATALOG.gameplayFillDefaults.grassland,
    });
    expect(KENNEY_HEX_ATLASES[grass.atlasId]).toBeDefined();

    const capital = resolveKenneyAtlasFrame('capital');
    expect(capital).toEqual({
      atlasId: 'buildings',
      frame: 'medieval_largeCastle.png',
    });
  });

  test('kenneyFrameName normalises stems', () => {
    expect(kenneyFrameName('grass_01')).toBe('grass_01.png');
    expect(kenneyFrameName('grass_01.png')).toBe('grass_01.png');
  });

  test('every gameplay sprite references a known atlas id', () => {
    for (const sprite of Object.values(KENNEY_HEX_GAMEPLAY_SPRITES)) {
      expect(KENNEY_HEX_ATLASES[sprite.atlas]).toBeDefined();
      expect(sprite.frame.endsWith('.png')).toBe(true);
    }
  });

  test('terrain gameplay keys map to curated catalog tiles', () => {
    const fillKeys = ['grassland', 'coast', 'mountain'];
    for (const key of fillKeys) {
      const sprite = KENNEY_HEX_GAMEPLAY_SPRITES[key];
      const meta = getKenneyTerrainTileMeta(sprite.frame);
      expect(meta?.role).toBe('fill');
    }

    const hill = getKenneyTerrainTileMeta(KENNEY_HEX_GAMEPLAY_SPRITES.hill.frame);
    expect(hill?.category).toBe('fill/plain_edges');

    const forest = getKenneyTerrainTileMeta(KENNEY_HEX_GAMEPLAY_SPRITES.forest.frame);
    expect(forest?.category).toBe('fill/forest/numerous');

    const desert = getKenneyTerrainTileMeta(KENNEY_HEX_GAMEPLAY_SPRITES.desert.frame);
    expect(desert?.biome).toBe('DarkDirt');
    expect(desert?.role).toBe('framed');
    expect(desert?.category).toBe('framed/by_darkdirt');
  });
});
