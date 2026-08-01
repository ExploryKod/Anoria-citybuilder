/**
 * Tests for SessionLedgerBuffer — in-memory journal session store.
 */

import {
  SessionLedgerBuffer,
  toDexieRow,
  toPublicEntry,
} from '../src/composition/accountingSessionJournal.js';

describe('SessionLedgerBuffer', () => {
  let buffer;

  beforeEach(() => {
    buffer = new SessionLedgerBuffer();
  });

  test('append stores entry with session metadata stripped from public view', () => {
    const record = buffer.append(
      { turn: 1, date: '2026-01-01', type: 'citizen_tax', amount: 100, description: 'Tax' },
      { persist: true }
    );

    expect(record.sessionId).toBe(1);
    expect(record.persisted).toBe(false);
    expect(toPublicEntry(record)).toEqual({
      turn: 1,
      date: '2026-01-01',
      type: 'citizen_tax',
      amount: 100,
      description: 'Tax',
    });
  });

  test('hydrateFromIdb marks existing rows as persisted', () => {
    buffer.hydrateFromIdb([
      { id: 42, turn: 0, date: '2026-01-01', type: 'capital_funds', amount: 500, description: 'Capital' },
    ]);

    expect(buffer.isHydrated()).toBe(true);
    expect(buffer.getPendingPersist()).toHaveLength(0);
    expect(buffer.getAllPublic()[0].id).toBe(42);
  });

  test('balance rows hydrated from IDB are not re-persisted', () => {
    buffer.hydrateFromIdb([
      { id: 1, turn: 5, date: '2026-01-01', type: 'balance', amount: 900, description: 'Solde' },
    ]);

    expect(buffer.getPendingPersist()).toHaveLength(0);
  });

  test('getPendingPersist excludes session-only balance entries', () => {
    buffer.markHydratedEmpty();
    buffer.append(
      { turn: 1, date: '2026-01-01', type: 'balance', amount: 100, description: 'Solde' },
      { persist: false }
    );
    buffer.append(
      { turn: 1, date: '2026-01-01', type: 'citizen_tax', amount: 50, description: 'Tax' },
      { persist: true }
    );

    expect(buffer.getPendingPersist()).toHaveLength(1);
    expect(buffer.getPendingPersist()[0].type).toBe('citizen_tax');
  });

  test('markPersisted assigns dexie id and clears pending state', () => {
    buffer.markHydratedEmpty();
    const record = buffer.append(
      { turn: 2, date: '2026-01-02', type: 'maintenance', amount: 10, description: 'Maint' },
      { persist: true }
    );

    buffer.markPersisted([{ sessionId: record.sessionId, id: 99 }]);

    expect(buffer.getPendingPersist()).toHaveLength(0);
    expect(buffer.getAllPublic()[0].id).toBe(99);
  });

  test('updateBalanceForTurn mutates session balance without persisting', () => {
    buffer.markHydratedEmpty();
    buffer.append(
      { turn: 3, date: '2026-01-03', type: 'balance', amount: 100, description: 'Solde' },
      { persist: false }
    );

    buffer.updateBalanceForTurn(3, 250);

    expect(buffer.findBalanceForTurn(3).amount).toBe(250);
    expect(buffer.getPendingPersist()).toHaveLength(0);
  });

  test('toDexieRow strips session metadata', () => {
    const record = buffer.append(
      { turn: 1, date: '2026-01-01', type: 'citizen_tax', amount: 10, description: 'T' },
      { persist: true }
    );

    expect(toDexieRow(record)).toEqual({
      turn: 1,
      date: '2026-01-01',
      type: 'citizen_tax',
      amount: 10,
      description: 'T',
    });
  });
});
