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
  });
});
