import { describe, expect, it } from '@jest/globals';
import { resolveKenneyGameplaySprite } from '../../../src/contexts/geography/domain/catalogs/HexAssetCatalog.js';
import { HAMLET_MAP_SITES } from '../../../src/contexts/geography/domain/catalogs/HamletMapCatalog.js';
import { WORLD_CITY_HEX_SITES } from '../../../src/contexts/geography/domain/catalogs/WorldCityHexCatalog.js';
import {
  WORLD_MAP_LAND_HEX_KEYS,
  WORLD_MAP_LAND_TILES,
  isWorldMapLandHex,
  isWorldMapShorelineHex,
} from '../../../src/contexts/geography/domain/world/worldMapDefinition.js';
import { hexKey } from '../../../src/shared/geography/hexCoordinates.js';

describe('worldMapDefinition', () => {
  it('covers every trade city hex with a Kenney terrain tile', () => {
    for (const site of Object.values(WORLD_CITY_HEX_SITES)) {
      expect(isWorldMapLandHex(site)).toBe(true);
      expect(WORLD_MAP_LAND_HEX_KEYS.has(hexKey(site))).toBe(true);
    }
  });

  it('covers every proto-hamlet hex with a Kenney terrain tile', () => {
    for (const site of HAMLET_MAP_SITES) {
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

  it('uses grassland on the ocean shoreline, not sand surrounded by sea', () => {
    const coastOnShore = WORLD_MAP_LAND_TILES.filter(
      (tile) => tile.terrain === 'coast' && isWorldMapShorelineHex(tile)
    );
    expect(coastOnShore).toHaveLength(0);
  });

  it('keeps authored coast only at the port of Maris', () => {
    const coastTiles = WORLD_MAP_LAND_TILES.filter((tile) => tile.terrain === 'coast');
    expect(coastTiles).toHaveLength(1);
    expect(coastTiles[0]).toMatchObject({ q: 2, r: 3 });
  });
});
