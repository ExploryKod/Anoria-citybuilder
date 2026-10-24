import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../src/core/persistence/dexie/db.js';
import { setActiveHamletId } from '../../src/core/persistence/hamlet/hamletSession.js';
import { getHudPopulationScopeSnapshot } from '../../src/composition/hudPopulationAggregates.js';
import { H, setupHamlets } from '../helpers/hamletIds.js';

describe('getHudPopulationScopeSnapshot', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await setupHamlets();
  });

  test('country scope sums all hamlets', async () => {
    await db.houses.bulkPut([
      {
        instanceId: '11111111-1111-4111-8111-111111111111',
        hamletId: H['eraanurbs'],
        type: 'House-Blue',
        x: 1,
        y: 1,
        pop: 5,
        roads: 1,
        stocks: { food: 10 },
      },
      {
        instanceId: '22222222-2222-4222-8222-222222222222',
        hamletId: H['clairiere'],
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

  test('a skill several classes grant has its vacant posts shared out equally, the extra ones to the first classes, and the shares add up', async () => {
    const { vacanciesShareOf } = await import('../../src/composition/hudPopulationAggregates.js');
    const providers = ['artisans', 'merchants', 'scholars'];

    expect(providers.map((group) => vacanciesShareOf(6, providers, group))).toEqual([2, 2, 2]);
    expect(providers.map((group) => vacanciesShareOf(7, providers, group))).toEqual([3, 2, 2]);
    expect(providers.map((group) => vacanciesShareOf(2, providers, group))).toEqual([1, 1, 0]);
    expect(vacanciesShareOf(5, ['merchants'], 'merchants')).toBe(5);
    expect(vacanciesShareOf(5, ['merchants'], 'artisans')).toBe(0);
  });

  test('mapEmploymentGroupsForHud derives unemployment percentage and lack per group', async () => {
    const { mapEmploymentGroupsForHud, laborSlotFromStats } = await import('../../src/composition/hudPopulationAggregates.js');
    const none = { unemployedNoSkill: 0, unemployedNoPosts: 0, unemployedNoRoad: 0, lackNoSkill: 0, lackNoHands: 0 };

    expect(
      mapEmploymentGroupsForHud(
        {
          artisans: { workerPool: 5, assigned: 3, seeking: 5, unemployed: 2, unemployedNoRoad: 0 },
          merchants: { workerPool: 0, assigned: 0, unemployed: 0 },
        },
        // The vacant posts are told by the skill they ask: the farm's belongs to the artisans, the market's to the merchants.
        {
          fermier: { need: 4 },
          'vente-alimentaire': { need: 3 },
        }
      )
    ).toEqual({
      administrators: {
        workerPool: 0,
        assigned: 0,
        unemployed: 0,
        unemploymentPercentage: 0,
        lack: 0,
        causes: none,
      },
      // 2 out of work while 4 posts are empty: the 2 do not match the posts (skill), and 2 posts are left with nobody to fill them.
      artisans: {
        workerPool: 5,
        assigned: 3,
        unemployed: 2,
        unemploymentPercentage: 40,
        lack: 4,
        causes: { unemployedNoSkill: 2, unemployedNoPosts: 0, unemployedNoRoad: 0, lackNoSkill: 2, lackNoHands: 2 },
      },
      // Nobody out of work, 3 posts that ask a merchant's skill: all of them are left with nobody to fill them.
      merchants: {
        workerPool: 0,
        assigned: 0,
        unemployed: 0,
        unemploymentPercentage: 0,
        lack: 3,
        causes: { ...none, lackNoHands: 3 },
      },
      scholars: {
        workerPool: 0,
        assigned: 0,
        unemployed: 0,
        unemploymentPercentage: 0,
        lack: 0,
        causes: none,
      },
    });

    // Out of work and vacant posts at the same time: both are shown (a mismatch of skills the player must see).
    expect(laborSlotFromStats({ lack: 3, unemployed: 2, unemploymentPercentage: 40 })).toEqual({
      mode: 'both',
      display: '40% · 3',
      count: 3,
      unemployed: 2,
      lack: 3,
    });
    expect(laborSlotFromStats({ lack: 3, unemployed: 0, unemploymentPercentage: 0 })).toMatchObject({ mode: 'lack', display: '3' });
    expect(laborSlotFromStats({ lack: 0, unemployed: 2, unemploymentPercentage: 40 })).toMatchObject({ mode: 'unemployment', display: '40%', count: 2 });
  });
});
