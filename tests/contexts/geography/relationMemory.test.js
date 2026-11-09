/**
 * The memory between two States: the relation is read from the journal of its events, each faded by the partner's memory with its age down to a residue that stays;
 * our customs make an event once, when the duty crosses the partner's tolerance (never one per month it stays high). Every city declares a full personality.
 */

import { describe, test, expect } from '@jest/globals';
import { customsMove, fadeOf, readRelation, relationTier } from '../../../src/contexts/geography/domain/policies/RelationMemoryPolicy.js';
import { PARTNER_TRAITS, TRADE_CATALOG, characterWordsOf, getTradeCatalogEntry, personalityOf } from '../../../src/shared/trade-catalog/TradeCatalog.js';

const YEAR = 360;
const event = (fields) => ({ cityId: 'olivea', kind: 'customs_hostile', good: 'wood', flow: 'export', turn: 0, year: 0, monthIndex: 0, weight: -15, ...fields });

describe('the relation is the faded sum of its journal', () => {
  test('an event fades by the partner\'s yearly loss and keeps its residue for ever', () => {
    const average = { yearlyLoss: 0.25, residue: 0.15 };
    expect(fadeOf(average, 0)).toBe(1);
    expect(fadeOf(average, 2)).toBeCloseTo(0.5);
    expect(fadeOf(average, 50)).toBe(0.15);
  });

  test('a tenacious partner (olivea) forgets more slowly than a forgetful one (silvania)', () => {
    const olivea = getTradeCatalogEntry('olivea');
    const silvania = getTradeCatalogEntry('silvania');
    const read = (entry) => readRelation({ events: [event({ cityId: entry.cityId })], entry, nowTurn: 2 * YEAR, turnsPerYear: YEAR }).score;
    expect(read(olivea)).toBeLessThan(0);
    expect(read(olivea)).toBeLessThan(read(silvania)); // olivea still holds more of the −15
  });

  test('the score is the sum of the events at their weight now, clamped, with its step, newest event first', () => {
    const entry = getTradeCatalogEntry('olivea');
    const reading = readRelation({ events: [event({ turn: 0 }), event({ kind: 'customs_relieved', weight: 8, turn: 10 })], entry, nowTurn: 10, turnsPerYear: YEAR });
    expect(reading.score).toBe(-7);
    expect(reading.tier).toBe('neutre');
    expect(reading.events.map((row) => row.kind)).toEqual(['customs_relieved', 'customs_hostile']);
    expect(() => readRelation({ events: [event({ kind: 'unheard_of' })], entry, nowTurn: 0, turnsPerYear: YEAR })).toThrow(/unheard_of/);
    expect([-100, -60, -59, -19, 20, 21, 59, 60].map(relationTier)).toEqual(['hostile', 'hostile', 'tendue', 'neutre', 'neutre', 'cordiale', 'cordiale', 'amie']);
  });

  test('a duty makes an event once at the crossing of the tolerance, and once back under it', () => {
    expect(customsMove({ dutyRate: 0.15, tolerance: 0.1, wasAbove: false })).toBe('customs_hostile');
    expect(customsMove({ dutyRate: 0.15, tolerance: 0.1, wasAbove: true })).toBeNull();
    expect(customsMove({ dutyRate: 0.05, tolerance: 0.1, wasAbove: true })).toBe('customs_relieved');
    expect(customsMove({ dutyRate: 0.05, tolerance: 0.1, wasAbove: false })).toBeNull();
  });
});

describe('every partner has a full personality', () => {
  test('each city names a declared level for each of the seven traits, and has a character to show', () => {
    expect(Object.keys(PARTNER_TRAITS)).toHaveLength(7);
    for (const entry of TRADE_CATALOG) {
      expect(Object.keys(personalityOf(entry))).toEqual(Object.keys(PARTNER_TRAITS));
      expect(characterWordsOf(entry).length).toBeGreaterThan(0);
    }
    expect(() => personalityOf({ cityId: 'x', personality: { memory: 'tenacious' } })).toThrow(/names no level/);
    expect(() => personalityOf({ cityId: 'x', personality: { ...TRADE_CATALOG[0].personality, memory: 'elephant' } })).toThrow(/not a level/);
  });
});
