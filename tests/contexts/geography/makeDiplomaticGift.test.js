/**
 * A gift to a partner city is paid in the journal first, and only then marks the relation; it weighs by the sum, capped, times the partner's gratitude;
 * the same gesture cannot be repeated before its cooldown. A refused payment leaves the relation untouched.
 */

import { describe, test, expect } from '@jest/globals';
import { MakeDiplomaticGift } from '../../../src/contexts/geography/application/workflows/MakeDiplomaticGift.js';
import { getTradeCatalogEntry } from '../../../src/shared/trade-catalog/TradeCatalog.js';

function build({ turn = 0, paid = { recorded: true } } = {}) {
  const events = [];
  const lines = [];
  const clock = { turn };
  const gift = new MakeDiplomaticGift({
    relationEvents: {
      record: async (event) => { events.push(event); },
      lastOfKind: async (cityId, kind) => events.filter((event) => event.cityId === cityId && event.kind === kind).at(-1) ?? null,
    },
    recordCityLine: async (line) => { lines.push(line); return paid; },
    now: () => ({ turn: clock.turn, year: 0, monthIndex: 0 }),
    daysPerMonth: () => 30,
    cityName: (cityId) => cityId,
  });
  return { gift, events, lines, clock };
}

describe('MakeDiplomaticGift', () => {
  test('pays the State\'s line, then writes an event weighed by the sum and the partner\'s gratitude', async () => {
    const { gift, events, lines } = build();
    const warm = getTradeCatalogEntry('silvania'); // gratitude: warm (×1.5)
    const result = await gift.execute({ entry: warm, amount: 200 });
    expect(result).toEqual({ done: true, points: 9 }); // 200 € → 6 points × 1.5
    expect(lines).toEqual([expect.objectContaining({ type: 'diplomatic_gift', amount: 200, partnerId: 'silvania' })]);
    expect(events).toEqual([expect.objectContaining({ kind: 'gift_received', weight: 9, cause: { amount: 200 } })]);
  });

  test('a huge gift is capped, a small one refused, a second one waits for the cooldown', async () => {
    const { gift, events, clock } = build();
    const entry = getTradeCatalogEntry('olivea'); // gratitude: normal
    expect(await gift.execute({ entry, amount: 50 })).toEqual({ done: false, reason: 'below_minimum' });
    expect(await gift.execute({ entry, amount: 100000 })).toEqual({ done: true, points: 20 });
    expect(await gift.execute({ entry, amount: 100 })).toMatchObject({ done: false, reason: 'cooling_down', readyAtTurn: 90 });
    clock.turn = 90;
    expect(await gift.execute({ entry, amount: 100 })).toMatchObject({ done: true });
    expect(events).toHaveLength(2);
  });

  test('a payment the journal refuses writes no event and says why', async () => {
    const { gift, events } = build({ paid: { recorded: false, reason: 'treasury_insufficient' } });
    expect(await gift.execute({ entry: getTradeCatalogEntry('olivea'), amount: 500 })).toEqual({ done: false, reason: 'treasury_insufficient' });
    expect(events).toHaveLength(0);
  });
});
