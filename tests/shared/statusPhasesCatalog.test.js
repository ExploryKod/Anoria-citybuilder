/** @jest-environment jsdom */
import { describe, test, expect } from '@jest/globals';
import { BUILDING_ASSETS } from '../../src/presentation/three/assets/buildingAssets.js';
import { getResourceRoles } from '../../src/shared/building-catalog/resourceRoleQueries.js';
import { STATUS_ICON_DEFAULTS } from '../../src/presentation/three/meshs/statusIconAnchors.js';

describe('mesh catalog cycleGraphics', () => {
  test('every graphic names a real status icon and says when or at which step it applies', () => {
    const graphics = Object.values(BUILDING_ASSETS).flatMap((asset) => asset.cycleGraphics ?? []);

    expect(graphics.length).toBeGreaterThan(0);
    for (const graphic of graphics) {
      expect(STATUS_ICON_DEFAULTS[graphic.status]).toBeDefined();
      expect(Boolean(graphic.when) !== Boolean(graphic.step)).toBe(true);
    }
  });

  test('a step-based graphic names a step its building really has', () => {
    for (const [type, asset] of Object.entries(BUILDING_ASSETS)) {
      const steps = getResourceRoles(type).flatMap((entry) => (entry.cycle ?? []).map((step) => step.id));
      for (const graphic of (asset.cycleGraphics ?? []).filter((g) => g.step)) {
        expect(steps).toContain(graphic.step);
      }
    }
  });
});
