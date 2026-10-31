/**
 * The starter city's journal is bundled with its legs: a new game shows real écritures from its first line, and every one balances.
 */
import { describe, test, expect } from '@jest/globals';
import { loadPrefab } from '../../../src/shared/prefabs/prefabCatalog.js';
import { assertBalanced } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';

const { journal: entries } = await loadPrefab('anoria-tour-107');

describe('the starter prefab journal', () => {
  test('every écriture carries its journal code and balanced legs', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      // The informative lines (`info_*`) move nothing and carry neither a journal code nor legs: only an écriture has them.
      if (entry.legs === undefined) {
        expect(entry.type).toMatch(/^info_/);
        continue;
      }
      expect({ id: entry.id, journal: entry.journal }).toEqual({ id: entry.id, journal: expect.any(String) });
      expect(() => assertBalanced(entry.legs, entry.type)).not.toThrow();
    }
  });
});
