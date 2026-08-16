import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../src/core/persistence/dexie/db.js';
import { setActiveHamletId, DEFAULT_HAMLET_ID } from '../../src/core/persistence/hamlet/hamletSession.js';
import { getHudPopulationScopeSnapshot } from '../../src/composition/hudPopulationAggregates.js';

describe('getHudPopulationScopeSnapshot', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
  });

  test('country scope sums all hamlets', async () => {
    await db.houses.bulkPut([
      {
        instanceId: '11111111-1111-4111-8111-111111111111',
        hamletId: 'eraanurbs',
        type: 'House-Blue',
        x: 1,
        y: 1,
        pop: 5,
        roads: 1,
        stocks: { food: 10 },
      },
      {
        instanceId: '22222222-2222-4222-8222-222222222222',
        hamletId: 'clairiere',
        type: 'House-Blue',
        x: 2,
        y: 2,
        pop: 3,
        roads: 1,
        stocks: { food: 10 },
      },
    ]);

    const country = await getHudPopulationScopeSnapshot('country');
    const active = await getHudPopulationScopeSnapshot('active');

    expect(country.totalPop).toBe(8);
    expect(active.totalPop).toBe(5);
    expect(country.popByGroup.merchants).toBe(8);
    expect(active.popByGroup.merchants).toBe(5);
  });

  test('mapEmploymentGroupsForHud derives unemployment percentage and lack per group', async () => {
    const { mapEmploymentGroupsForHud, laborSlotFromStats } = await import('../../src/composition/hudPopulationAggregates.js');

    expect(
      mapEmploymentGroupsForHud(
        {
          artisans: { workerPool: 5, assigned: 3, unemployed: 2 },
          merchants: { workerPool: 0, assigned: 0, unemployed: 0 },
        },
        {
          1: { need: 4 },
          2: { need: 0 },
        }
      )
    ).toEqual({
      artisans: {
        workerPool: 5,
        assigned: 3,
        unemployed: 2,
        unemploymentPercentage: 40,
        lack: 4,
      },
      merchants: {
        workerPool: 0,
        assigned: 0,
        unemployed: 0,
        unemploymentPercentage: 0,
        lack: 0,
      },
      scholars: {
        workerPool: 0,
        assigned: 0,
        unemployed: 0,
        unemploymentPercentage: 0,
        lack: 0,
      },
    });

    expect(laborSlotFromStats({ lack: 3, unemployed: 2, unemploymentPercentage: 40 })).toEqual({
      mode: 'lack',
      display: '3',
      count: 3,
    });
    expect(laborSlotFromStats({ lack: 0, unemployed: 2, unemploymentPercentage: 40 })).toEqual({
      mode: 'unemployment',
      display: '40%',
      count: 2,
    });
  });
});
