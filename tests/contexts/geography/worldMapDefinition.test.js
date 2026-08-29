import { describe, expect, it } from '@jest/globals';
import { resolveKenneyGameplaySprite } from '../../../src/contexts/geography/domain/catalogs/HexAssetCatalog.js';
import { WORLD_CITY_HEX_SITES } from '../../../src/contexts/geography/domain/catalogs/WorldCityHexCatalog.js';
import {
  WORLD_MAP_LAND_HEX_KEYS,
  WORLD_MAP_LAND_TILES,
  isWorldMapLandHex,
} from '../../../src/contexts/geography/domain/world/worldMapDefinition.js';
import { hexKey } from '../../../src/shared/geography/hexCoordinates.js';

describe('worldMapDefinition', () => {
  it('covers every trade city hex with a Kenney terrain tile', () => {
    for (const site of Object.values(WORLD_CITY_HEX_SITES)) {
      expect(isWorldMapLandHex(site)).toBe(true);
      expect(WORLD_MAP_LAND_HEX_KEYS.has(hexKey(site))).toBe(true);
    }
  });

  it('only uses terrain keys that resolve to Kenney frames', () => {
    for (const tile of WORLD_MAP_LAND_TILES) {
      expect(resolveKenneyGameplaySprite(tile.terrain)).not.toBeNull();
    }
  });

  it('has one tile per land hex key', () => {
    const keys = WORLD_MAP_LAND_TILES.map((tile) => hexKey(tile));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(WORLD_MAP_LAND_HEX_KEYS.size);
  });
});
