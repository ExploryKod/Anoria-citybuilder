/** @jest-environment jsdom */
import { describe, test, expect } from '@jest/globals';
import { buildingCatalog } from '../../src/shared/building-catalog/buildingCatalog.js';
import { STATUS_ICON_DEFAULTS } from '../../src/presentation/three/meshs/statusIconAnchors.js';

describe('catalog statusPhases', () => {
  test('every declared phase names a real status icon and a season', () => {
    const phases = Object.values(buildingCatalog)
      .flatMap((def) => def.resourceRoles ?? [])
      .flatMap((entry) => entry.statusPhases ?? []);

    expect(phases.length).toBeGreaterThan(0);
    for (const { season, status } of phases) {
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(season);
      expect(STATUS_ICON_DEFAULTS[status]).toBeDefined();
    }
  });
});
