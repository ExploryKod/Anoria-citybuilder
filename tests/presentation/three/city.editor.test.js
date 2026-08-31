import { describe, expect, test } from '@jest/globals';
import {
  createCity,
  initializeEditorCityTiles,
} from '../../../src/presentation/three/city.js';
import { EDITOR_SEA_TERRAIN_ID } from '../../../src/shared/terrain-catalog/editorSeaTerrain.js';

describe('initializeEditorCityTiles', () => {
  test('sets every cell to editor sea with no buildings', () => {
    const city = createCity(4);
    city.tiles[1][2].terrainId = 'nature:ground_grass';
    city.tiles[1][2].buildingId = 'House-Blue';
    city.tiles[1][2].instanceId = 'house-1';

    initializeEditorCityTiles(city);

    for (let x = 0; x < city.size; x += 1) {
      for (let y = 0; y < city.size; y += 1) {
        const tile = city.tiles[x][y];
        expect(tile.terrainId).toBe(EDITOR_SEA_TERRAIN_ID);
        expect(tile.buildingId).toBeUndefined();
        expect(tile.instanceId).toBeUndefined();
      }
    }
  });
});
