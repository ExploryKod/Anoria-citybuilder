/**
 * An embargo is an event of the relation's journal and nothing else: the one in force is read from the last event of each good and flow. It stops that good in that flow (the
 * cease reasons `embargo` / `export_embargo`, the city's), the other goods and the other flow go on. A decree or a lifting that changes nothing is refused with its reason.
 */

import { describe, test, expect } from '@jest/globals';
import { SetTradeEmbargo } from '../../../src/contexts/geography/application/workflows/SetTradeEmbargo.js';
import { embargoKey, embargoesIn } from '../../../src/contexts/geography/domain/policies/RelationMemoryPolicy.js';
import { findCeaseReason } from '../../../src/contexts/geography/domain/policies/TradeCeasePolicy.js';
import { TRADE_CATALOG } from '../../../src/shared/trade-catalog/TradeCatalog.js';

// A partner that both wants goods from us (merchantGood set) and offers goods to us.
const entry = TRADE_CATALOG.find((candidate) => candidate.wants.some((want) => want.merchantGood) && candidate.offers.length > 0);

function build() {
  const events = [];
  const embargo = new SetTradeEmbargo({
    relationEvents: {
      record: async (event) => { events.push(event); },
      embargoesOf: async (cityId) => embargoesIn(events.filter((event) => event.cityId === cityId)),
    },
    now: () => ({ turn: 10, year: 0, monthIndex: 1 }),
  });
  return { embargo, events };
}

describe('the embargo the city decrees', () => {
  test('a decree writes one event and the embargo is read from it; lifting reads it away', async () => {
    const { embargo, events } = build();
    const good = entry.offers[0].good;
    expect(await embargo.execute({ entry, flow: 'import', good, decreed: true })).toEqual({ done: true, goods: [good] });
    expect(events).toEqual([expect.objectContaining({ kind: 'embargo_decreed', good, flow: 'import', weight: expect.any(Number) })]);
    expect(embargoesIn(events).has(embargoKey('import', good))).toBe(true);
    expect(embargoesIn(events).has(embargoKey('export', good))).toBe(false);

    expect(await embargo.execute({ entry, flow: 'import', good, decreed: false })).toEqual({ done: true, goods: [good] });
    expect(embargoesIn(events).size).toBe(0);
  });

  test('a whole side at once is one event per good, and a measure that changes nothing is refused', async () => {
    const { embargo, events } = build();
    const exported = SetTradeEmbargo.goodsOf(entry, 'export');
    expect(await embargo.execute({ entry, flow: 'export', good: null, decreed: true })).toEqual({ done: true, goods: exported });
    expect(events).toHaveLength(exported.length);
    expect(await embargo.execute({ entry, flow: 'export', good: null, decreed: true })).toEqual({ done: false, reason: 'already_embargoed' });
    expect(await embargo.execute({ entry, flow: 'import', good: null, decreed: false })).toEqual({ done: false, reason: 'not_embargoed' });
    expect(await embargo.execute({ entry, flow: 'export', good: 'no-such-good', decreed: true })).toEqual({ done: false, reason: 'not_traded' });
  });
});

describe('what an embargo stops', () => {
  test('it is the first reason, the city\'s, in its own flow only; a context that does not say throws', () => {
    expect(findCeaseReason('import', { failures: {}, embargoed: true })).toEqual({ reason: 'embargo', by: 'city' });
    expect(findCeaseReason('export', { failures: {}, embargoed: true, exportPricing: { unitNet: 2, unitCost: 1 } })).toEqual({ reason: 'export_embargo', by: 'city' });
    expect(() => findCeaseReason('import', { failures: {} })).toThrow(/embargoed/);
  });
});
