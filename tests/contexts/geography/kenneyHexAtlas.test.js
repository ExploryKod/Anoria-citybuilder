import { describe, expect, test } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  KENNEY_HEX_ATLASES,
  KENNEY_HEX_GAMEPLAY_SPRITES,
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
      frame: 'grass_01.png',
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
});
