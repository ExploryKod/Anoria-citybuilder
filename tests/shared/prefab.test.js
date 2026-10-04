/**
 * Regression guard for the prefab "anoria-tour-61": its exported buildings keep their positions, and its
 * journal gives back the balance the game showed at the moment of the export.
 */

import { describe, test, expect } from '@jest/globals';
import { PREFABS } from '../../src/shared/prefabs/prefabCatalog.js';
import { canonicalizeHouseRecord } from '../../src/shared/building-identity/index.js';
import { deriveTreasuryFigures } from '../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';

const prefab = PREFABS['anoria-tour-116'];

describe('prefab anoria-tour-116 — its state is the saved one', () => {
  test('every exported building keeps the anchor it was saved at, in its hamlet', () => {
    for (const building of prefab.city.buildings) {
      const record = canonicalizeHouseRecord(building);
      expect(record.anchorX).toBe(building.x);
      expect(record.anchorY).toBe(building.y);
      expect(record.hamletId).toBe(prefab.hamletId);
    }
  });

  test('its journal derives the balance of the export (−52 148 €)', () => {
    const figures = deriveTreasuryFigures(prefab.journal, { currentTurn: prefab.turn });
    expect(figures.funds).toBe(-52148);
  });
});
