/**
 * What a partner does on its own (PartnerPolicy.js): its embargo on us holds until its end and no longer; a partner that retaliates answers an embargo of ours once, in the other
 * flow, after its delay; one that breaks cuts the relation under the city's own threshold, and a paid mission renews it (RenewRelation.js) after the wait.
 */

import { describe, test, expect } from '@jest/globals';
import { breakDue, retaliationDue } from '../../../src/contexts/geography/domain/policies/PartnerPolicy.js';
import { embargoKey, partnerEmbargoesIn } from '../../../src/contexts/geography/domain/policies/RelationMemoryPolicy.js';
import { RenewRelation } from '../../../src/contexts/geography/application/workflows/RenewRelation.js';
import { getTradeCatalogEntry } from '../../../src/shared/trade-catalog/TradeCatalog.js';

const silvania = getTradeCatalogEntry('silvania'); // retaliates; wants gold (export), offers exoticWood (import)
const sablia = getTradeCatalogEntry('sablia'); // breaks, under -60

describe('the partner\'s embargo on us', () => {
  test('holds until the turn its cause names, and no longer', () => {
    const events = [{ cityId: 'silvania', kind: 'partner_embargo_started', good: 'gold', flow: 'export', turn: 0, weight: -10, cause: { untilTurn: 180 } }];
    expect(partnerEmbargoesIn(events, 179).has(embargoKey('export', 'gold'))).toBe(true);
    expect(partnerEmbargoesIn(events, 180).has(embargoKey('export', 'gold'))).toBe(false);
  });
});

describe('a partner that retaliates', () => {
  const decree = { cityId: 'silvania', kind: 'embargo_decreed', good: 'gold', flow: 'export', turn: 0, weight: -12 };

  test('answers once, a month later, in the other flow', () => {
    expect(retaliationDue({ events: [decree], entry: silvania, nowTurn: 29, daysPerMonth: 30 })).toBeNull();
    const due = retaliationDue({ events: [decree], entry: silvania, nowTurn: 30, daysPerMonth: 30 });
    expect(due).toMatchObject({ flow: 'import', good: 'exoticWood', answers: 'export:gold@0' });
    const answered = { cityId: 'silvania', kind: 'partner_embargo_started', good: 'exoticWood', flow: 'import', turn: 30, weight: -10, cause: { untilTurn: 120, answers: due.answers } };
    expect(retaliationDue({ events: [decree, answered], entry: silvania, nowTurn: 60, daysPerMonth: 30 })).toBeNull();
  });

  test('does not answer an embargo the city has lifted, nor does a placid partner answer at all', () => {
    const lifted = { ...decree, kind: 'embargo_lifted', turn: 10, weight: 6 };
    expect(retaliationDue({ events: [decree, lifted], entry: silvania, nowTurn: 60, daysPerMonth: 30 })).toBeNull();
    expect(retaliationDue({ events: [{ ...decree, cityId: 'olivea' }], entry: getTradeCatalogEntry('olivea'), nowTurn: 60, daysPerMonth: 30 })).toBeNull();
  });
});

describe('a partner that breaks', () => {
  test('cuts only under the city\'s own threshold, and only when its reaction is to break', () => {
    expect(breakDue({ entry: sablia, score: -59 })).toBe(false);
    expect(breakDue({ entry: sablia, score: -61 })).toBe(true);
    expect(breakDue({ entry: silvania, score: -100 })).toBe(false);
  });
});

describe('RenewRelation', () => {
  function build({ status = 'expired', turn = 200, paid = { recorded: true } } = {}) {
    const events = [{ cityId: 'sablia', kind: 'relation_broken', turn: 0, weight: -5 }];
    const lines = [];
    let relation = { cityId: 'sablia', status, ceased: { by: 'partner', reason: 'relation_broken', turn: 0 } };
    const renewal = new RenewRelation({
      cityTradeRepository: { getRelation: async () => relation, saveRelation: async (next) => { relation = next; } },
      relationEvents: {
        record: async (event) => { events.push(event); },
        lastOfKind: async (cityId, kind) => events.filter((event) => event.cityId === cityId && event.kind === kind).at(-1) ?? null,
      },
      recordCityLine: async (line) => { lines.push(line); return paid; },
      now: () => ({ turn, year: 0, monthIndex: 0 }),
      daysPerMonth: () => 30,
      cityName: (cityId) => cityId,
    });
    return { renewal, events, lines, relationOf: () => relation };
  }

  test('pays first, then reopens the relation and writes the event', async () => {
    const { renewal, events, lines, relationOf } = build();
    expect(await renewal.execute({ entry: sablia })).toMatchObject({ done: true });
    expect(lines).toEqual([expect.objectContaining({ type: 'diplomatic_mission', amount: 300, partnerId: 'sablia' })]);
    expect(relationOf()).toMatchObject({ status: 'active', ceased: null });
    expect(events.at(-1)).toMatchObject({ kind: 'relation_renewed', weight: 40 });
  });

  test('refuses a relation that is not broken, a mission too soon, and a payment the journal refuses', async () => {
    expect(await build({ status: 'active' }).renewal.execute({ entry: sablia })).toEqual({ done: false, reason: 'not_broken' });
    expect(await build({ turn: 100 }).renewal.execute({ entry: sablia })).toMatchObject({ done: false, reason: 'renewal_cooling_down', readyAtTurn: 180 });
    const refused = build({ paid: { recorded: false, reason: 'treasury_insufficient' } });
    expect(await refused.renewal.execute({ entry: sablia })).toEqual({ done: false, reason: 'treasury_insufficient' });
    expect(refused.relationOf().status).toBe('expired');
  });
});
