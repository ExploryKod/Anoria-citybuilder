/** @jest-environment jsdom */
import { describe, test, expect } from '@jest/globals';
import { spriteOf } from '../../../src/presentation/three/meshs/roleStatusSprites.js';
import { textures } from '../../../src/presentation/three/meshs/data.js';
import { STATUS_ICON_DEFAULTS } from '../../../src/presentation/three/meshs/statusIconAnchors.js';
import { BUILDING_ASSETS } from '../../../src/presentation/three/assets/buildingAssets.js';

// The asset manager draws the "no road" image for a status whose texture is missing, so a wrong texture key
// never fails loudly: it just puts a no-road icon on the wrong building.
describe('every status the role sprites can draw has a texture', () => {
  const statuses = new Set([
    'no-food',
    'isBuying',
    'isCollecting',
    'sold-to-hub',
    ...Object.values(BUILDING_ASSETS).flatMap((asset) => (asset.cycleGraphics ?? []).map((graphic) => graphic.status)),
  ]);

  test.each([...statuses])('%s', (status) => {
    expect(STATUS_ICON_DEFAULTS[status]).toBeDefined();
    expect(textures[spriteOf(status).texture]).toBeDefined();
  });
});
