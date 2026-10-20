import { describe, test, expect } from '@jest/globals';
import { allocateToClient, availableToClient } from '../../../src/contexts/supply/domain/policies/HubClientAllocationPolicy.js';
import { reconcileLots, UNATTRIBUTED } from '../../../src/contexts/supply/domain/policies/HubLotsPolicy.js';
import { othersWanted, recordClientDemand } from '../../../src/contexts/supply/domain/policies/HubClientDemandPolicy.js';

const serve = (order, disabled = []) => () => ({ order, disabled });
const total = (takes) => takes.reduce((sum, take) => sum + take.amount, 0);

describe('hub clients — served in rank order, nothing held back for nobody', () => {
  test('a lower-ranked client only gets what the higher-ranked one leaves', () => {
    const args = { lots: { lumber: 10 }, priorityOf: serve(['market', 'workshop']), othersWanted: { market: 7 } };
    expect(total(allocateToClient({ ...args, client: 'workshop', want: 10 }))).toBe(3);
    expect(total(allocateToClient({ ...args, client: 'market', want: 7 }))).toBe(7);
  });

  test('when the higher-ranked client wants nothing, the whole lot goes to the next', () => {
    const args = { lots: { lumber: 10 }, priorityOf: serve(['market', 'workshop']), othersWanted: {} };
    expect(total(allocateToClient({ ...args, client: 'workshop', want: 10 }))).toBe(10);
  });

  test('a client a lot does not serve gets nothing from it, whatever is left', () => {
    const args = { lots: { lumber: 10 }, priorityOf: serve(['market', 'workshop'], ['workshop']), othersWanted: {} };
    expect(availableToClient({ ...args, client: 'workshop' })).toBe(0);
    expect(availableToClient({ ...args, client: 'market' })).toBe(10);
  });

  test('each lot carries its own order: a client ranks differently in two lots', () => {
    const priorityOf = (key) => (key === 'forMarkets' ? { order: ['market', 'workshop'], disabled: [] } : { order: ['workshop', 'market'], disabled: [] });
    const lots = { forMarkets: 5, forWorkshops: 5 };
    // The market wants 5, the workshop wants 5: each is served from the lot that ranks it first.
    const market = allocateToClient({ lots, priorityOf, othersWanted: { workshop: 5 }, client: 'market', want: 5 });
    expect(market).toEqual([{ key: 'forMarkets', amount: 5 }]);
  });

  test('stock the lots do not account for serves everybody', () => {
    const lots = reconcileLots({}, 8);
    expect(lots).toEqual({ [UNATTRIBUTED]: 8 });
    expect(total(allocateToClient({ lots, priorityOf: serve([]), othersWanted: { market: 8 }, client: 'workshop', want: 8 }))).toBe(8);
  });
});

describe('hub lots and client memory', () => {
  test('lots are trimmed to the stock, unattributed first', () => {
    expect(reconcileLots({ [UNATTRIBUTED]: 3, lumber: 10 }, 11)).toEqual({ lumber: 10, [UNATTRIBUTED]: 1 });
  });

  test('a client that asks every tick keeps what it wanted; one that asked once keeps only what it missed', () => {
    let entries = recordClientDemand(undefined, 'market', 1, 5, 5);
    entries = recordClientDemand(entries, 'market', 2, 5, 5);
    entries = recordClientDemand(entries, 'workshop', 2, 10, 10);
    expect(othersWanted(entries, 'workshop', 3).market).toBe(5);
    expect(othersWanted(entries, 'market', 3).workshop).toBe(0);
  });
});

describe('hub pie — the same good from different producers keeps its colour, in another tone', () => {
  test('tones differ but stay the good\'s own hue', async () => {
    const { toneVariant } = await import('../../../src/contexts/supply/domain/policies/HubStoragePiePolicy.js');
    const base = '#6D4C2C';
    expect(toneVariant(base, 0)).toBe(base.toLowerCase());
    expect(toneVariant(base, 1)).not.toBe(toneVariant(base, 2));
    expect(toneVariant(base, 1)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
