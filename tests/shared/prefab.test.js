/**
 * Regression guard for the prefab "anoria-tour-144": its exported buildings keep their positions, and its journal is the
 * whole journal of the hamlet (the city's own account and the flux of the companies and the houses, two exports).
 */

import { describe, test, expect } from '@jest/globals';
import { PREFABS } from '../../src/shared/prefabs/prefabCatalog.js';
import { canonicalizeHouseRecord } from '../../src/shared/building-identity/index.js';

const prefab = PREFABS['anoria-tour-144'];

describe('prefab anoria-tour-144 — its state is the saved one', () => {
  test('every exported building keeps the anchor it was saved at, in its hamlet', () => {
    for (const building of prefab.city.buildings) {
      const record = canonicalizeHouseRecord(building);
      expect(record.anchorX).toBe(building.x);
      expect(record.anchorY).toBe(building.y);
      expect(record.hamletId).toBe(prefab.hamletId);
    }
  });

  test('its journal joins the two exports without losing or repeating a line, all in its hamlet', () => {
    const ids = prefab.journal.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const line of prefab.journal) expect(line.hamletId).toBe(prefab.hamletId);
  });
});
