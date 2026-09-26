import { describe, test, expect } from '@jest/globals';
import { BUILDING_ASSETS } from '../../src/presentation/three/assets/buildingAssets.js';
import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../../src/shared/building-catalog/kenneyCityKitRegistry.generated.js';
import { resolveFootprint } from '../../src/shared/asset-footprint/resolveFootprint.js';
import { buildingCatalog } from '../../src/shared/building-catalog/buildingCatalog.js';

// A placeable building's footprint must be its mesh's real size: otherwise a road can sit under half of it,
// and "a road touching the building" (its road access) is measured from tiles it does not cover.
// These already differed when this guard was written — fix them and delete them from the list, never add.
const KNOWN_MISMATCHES = ['House-2Story', 'Hay-Bale', 'Hay-Cart', 'Hay-Pile', 'Crate-001', 'BookShop-001'];

describe('a building\'s footprint matches the kit mesh it wears', () => {
  test('every placeable kit building, but the known ones', () => {
    const wrong = [];
    for (const [id, asset] of Object.entries(BUILDING_ASSETS)) {
      if (asset.source !== 'kenneyCityKit' || !asset.button || KNOWN_MISMATCHES.includes(id)) continue;
      const real = KENNEY_BUILDING_CATALOG_ENTRIES[asset.geometry.buildingId].construction;
      const declared = resolveFootprint(id);
      if (real.footprintWidth !== declared.width || real.footprintDepth !== declared.depth) {
        wrong.push(`${id}: mesh ${real.footprintWidth}x${real.footprintDepth}, catalog ${declared.width}x${declared.depth}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('every building of the catalog declares a footprint', () => {
  // Road access is measured from the footprint and throws for a type without one: none may be missing.
  test('none is missing', () => {
    const missing = Object.keys(buildingCatalog).filter((id) => {
      try {
        resolveFootprint(id);
        return false;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });
});
