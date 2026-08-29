import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../../src/core/persistence/dexie/db.js';
import {
  getCheatActivation,
  listCheatActivations,
  normalizeCheatCode,
  recordCheatActivation,
} from '../../../../src/core/persistence/cheat/cheatCodeRepository.js';

describe('cheatCodeRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test('normalizeCheatCode trims input', () => {
    expect(normalizeCheatCode('  Treasury  ')).toBe('Treasury');
    expect(normalizeCheatCode('')).toBe('');
  });

  test('recordCheatActivation stores and increments activation count', async () => {
    const first = await recordCheatActivation('Treasury', { message: 'ok' });
    expect(first.code).toBe('Treasury');
    expect(first.activationCount).toBe(1);
    expect(first.lastMeta).toEqual({ message: 'ok' });

    const second = await recordCheatActivation('Treasury');
    expect(second.activationCount).toBe(2);

    const stored = await getCheatActivation('Treasury');
    expect(stored?.activationCount).toBe(2);

    const all = await listCheatActivations();
    expect(all).toHaveLength(1);
  });
});
