import { describe, expect, test } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  KENNEY_HEX_ATLASES,
  KENNEY_HEX_GAMEPLAY_SPRITES,
  KENNEY_TERRAIN_CATALOG,
  getKenneyTerrainTileMeta,
  kenneyFrameName,
  resolveKenneyPhaserFrame,
} from '../../../src/contexts/geography/domain/catalogs/HexAssetCatalog.js';
import { verifyKenneyHexAtlasFiles } from '../../../scripts/verifyKenneyHexAtlases.js';

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../public');

describe('Kenney hex atlases (Phaser)', () => {
  test('PNG and XML pairs exist on disk with valid imagePath', () => {
    const result = verifyKenneyHexAtlasFiles(publicRoot);
    if (!result.ok) {
      throw new Error(result.errors.join('\n'));
    }
    expect(result.ok).toBe(true);
  });

  test('resolveKenneyPhaserFrame maps gameplay keys to atlas texture keys', () => {
    const grass = resolveKenneyPhaserFrame('grassland');
    expect(grass).toEqual({
      textureKey: KENNEY_HEX_ATLASES.terrain.key,
      frame: KENNEY_TERRAIN_CATALOG.gameplayFillDefaults.grassland,
    });

    const capital = resolveKenneyPhaserFrame('capital');
    expect(capital).toEqual({
      textureKey: KENNEY_HEX_ATLASES.buildings.key,
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
