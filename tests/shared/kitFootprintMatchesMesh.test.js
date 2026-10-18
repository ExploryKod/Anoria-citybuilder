import { describe, test, expect } from '@jest/globals';
import { BUILDING_ASSETS } from '../../src/presentation/three/assets/buildingAssets.js';
import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../../src/shared/building-catalog/kenneyCityKitRegistry.generated.js';
import { resolveFootprint } from '../../src/shared/asset-footprint/resolveFootprint.js';
import { buildingCatalog } from '../../src/shared/building-catalog/buildingCatalog.js';

/**
 * A building made of several meshes: its real size is the box that holds them all (each part sits at an offset, in tiles, from
 * the plot's centre), and the parts must fill the plot exactly, without overlapping one another or reaching past it.
 */
function sizeOfParts(parts, declared, id, wrong) {
  const boxes = parts.map((part) => {
    const size = KENNEY_BUILDING_CATALOG_ENTRIES[part.buildingId].construction;
    return { minX: part.x - size.footprintWidth / 2, maxX: part.x + size.footprintWidth / 2, minZ: part.z - size.footprintDepth / 2, maxZ: part.z + size.footprintDepth / 2 };
  });
  boxes.forEach((box, index) => {
    boxes.slice(index + 1).forEach((other) => {
      const overlaps = box.minX < other.maxX && other.minX < box.maxX && box.minZ < other.maxZ && other.minZ < box.maxZ;
      if (overlaps) wrong.push(`${id}: two parts overlap`);
    });
  });
  const minX = Math.min(...boxes.map((box) => box.minX));
  const maxX = Math.max(...boxes.map((box) => box.maxX));
  const minZ = Math.min(...boxes.map((box) => box.minZ));
  const maxZ = Math.max(...boxes.map((box) => box.maxZ));
  if (minX !== -declared.width / 2 || maxX !== declared.width / 2 || minZ !== -declared.depth / 2 || maxZ !== declared.depth / 2) {
    wrong.push(`${id}: its parts do not sit on its plot`);
  }
  return { footprintWidth: maxX - minX, footprintDepth: maxZ - minZ };
}

// A placeable building's footprint must be its mesh's real size: otherwise a road can sit under half of it,
// and "a road touching the building" (its road access) is measured from tiles it does not cover.
// A house is the exception: it reserves a plot at least as large as its model (the model sits in the middle).
describe('a building\'s footprint matches the kit mesh it wears', () => {
  test('every placeable kit building', () => {
    const wrong = [];
    for (const [id, asset] of Object.entries(BUILDING_ASSETS)) {
      if (asset.source !== 'kenneyCityKit' || !asset.button) continue;
      const declared = resolveFootprint(id);
      const real = asset.geometry.parts ? sizeOfParts(asset.geometry.parts, declared, id, wrong) : KENNEY_BUILDING_CATALOG_ENTRIES[asset.geometry.buildingId].construction;
      const isHouse = Boolean(buildingCatalog[id]?.residentialGroup);
      const wrongSize = isHouse
        ? real.footprintWidth > declared.width || real.footprintDepth > declared.depth
        : real.footprintWidth !== declared.width || real.footprintDepth !== declared.depth;
      if (wrongSize) {
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
