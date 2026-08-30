import { describe, expect, test } from '@jest/globals';
import {
  KENNEY_GROUND_GRASS_COLOR,
  SCENE_FOG_COLOR,
  SCENE_SEA_COLOR,
  SCENE_SKY_COLOR,
  createSceneFog,
} from '../../../src/shared/terrain-catalog/terrainAtmosphere.js';
import { blendTerrainColorHex } from '../../../src/shared/terrain-catalog/terrainColorBlend.js';

describe('terrainAtmosphere', () => {
  test('Kenney grass color matches isometric preview reference', () => {
    expect(KENNEY_GROUND_GRASS_COLOR).toBe(0x2fe7c5);
  });

  test('fog color is blended from grass and sky', () => {
    expect(SCENE_FOG_COLOR).toBe(
      blendTerrainColorHex(KENNEY_GROUND_GRASS_COLOR, SCENE_SKY_COLOR, 0.42)
    );
  });

  test('editor fog color is blended from sea and sky', () => {
    const fog = createSceneFog({ editor: true });
    expect(fog.color.getHex()).toBe(
      blendTerrainColorHex(SCENE_SEA_COLOR, SCENE_SKY_COLOR, 0.35)
    );
  });

  test('createSceneFog returns FogExp2', () => {
    const fog = createSceneFog();
    expect(fog.isFogExp2).toBe(true);
    expect(fog.density).toBeGreaterThan(0);
  });
});
