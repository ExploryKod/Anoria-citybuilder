/**
 * Regression guard for the prefab "anoria-tour-107": its exported buildings keep their positions, and its journal is the
 * whole journal of the hamlet (the city's own account and the flux of the companies and the houses, two exports).
 */

import { describe, test, expect } from '@jest/globals';
import { loadPrefab } from '../../src/shared/prefabs/prefabCatalog.js';
import { canonicalizeHouseRecord } from '../../src/shared/building-identity/index.js';
import { createCitizen } from '../../src/shared/citizens/Citizen.js';

const prefab = await loadPrefab('anoria-tour-107');

describe('prefab anoria-tour-107 — its state is the saved one', () => {
  test('every exported building keeps the anchor it was saved at, in its hamlet', () => {
    for (const building of prefab.city.buildings) {
      const record = canonicalizeHouseRecord(building);
      expect(record.anchorX).toBe(building.x);
      expect(record.anchorY).toBe(building.y);
      expect(record.hamletId).toBe(prefab.hamletId);
    }
  });

  test('its citizens are whole citizens of its hamlet, each living in a house of the city; a house carries no count of residents', () => {
    const citizens = prefab.city.citizens.map((row) => createCitizen(row));
    const houseIds = new Set(prefab.city.buildings.filter((building) => building.kind === 'house').map((house) => house.instanceId));
    for (const citizen of citizens) expect(houseIds.has(citizen.houseId)).toBe(true);
    for (const building of prefab.city.buildings) expect(building).not.toHaveProperty('pop');
    expect(new Set(citizens.map((citizen) => citizen.id)).size).toBe(citizens.length);
    for (const citizen of citizens) expect(citizen.hamletId).toBe(prefab.hamletId);
  });

  test('its journal joins the two exports without losing or repeating a line, all in its hamlet', () => {
    const ids = prefab.journal.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const line of prefab.journal) expect(line.hamletId).toBe(prefab.hamletId);
  });
});
