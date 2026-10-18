/**
 * The starter city's journal is bundled with its legs: a new game shows real écritures from its first line, and every one balances.
 */
import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { assertBalanced } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';

const { entries } = JSON.parse(fs.readFileSync(path.resolve('src/shared/prefabs/anoria-tour-116/journal-2026-10-04-172419.json'), 'utf8'));

describe('the starter prefab journal', () => {
  test('every écriture carries its journal code and balanced legs', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect({ id: entry.id, journal: entry.journal }).toEqual({ id: entry.id, journal: expect.any(String) });
      expect(() => assertBalanced(entry.legs, entry.type)).not.toThrow();
    }
  });
});
