import { describe, expect, test, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/composition/hudPopulationAggregates.js', () => ({
  laborSlotFromStats: (stats = {}) => {
    const lack = stats.lack ?? 0;
    if (lack > 0) {
      return { mode: 'lack', display: String(lack), count: lack };
    }
    return {
      mode: 'unemployment',
      display: `${stats.unemploymentPercentage ?? 0}%`,
      count: stats.unemployed ?? 0,
    };
  },
  mapEmploymentGroupsForHud: (byGroup = {}, bySector = {}) => {
    const groups = ['artisans', 'merchants', 'scholars'];
    const sectors = { artisans: [1, 3, 4], merchants: [2], scholars: [6] };
    return Object.fromEntries(
      groups.map((group) => {
        const stats = byGroup[group] ?? { workerPool: 0, assigned: 0, unemployed: 0 };
        const workerPool = stats.workerPool ?? 0;
        const unemployed = stats.unemployed ?? 0;
        let lack = 0;
        for (const sector of sectors[group]) {
          lack += bySector[sector]?.need ?? 0;
        }
        return [
          group,
          {
            workerPool,
            assigned: stats.assigned ?? 0,
            unemployed,
            unemploymentPercentage: workerPool > 0 ? Math.round((unemployed / workerPool) * 100) : 0,
            lack,
          },
        ];
      })
    );
  },
  getHudPopulationScopeSnapshot: jest.fn(async (scope) => {
    if (scope === 'country') {
      return {
        totalPop: 10,
        popByGroup: { artisans: 6, merchants: 4, scholars: 0 },
        famishedPopulation: 2,
        employment: {
          activeCitizenCount: 4,
          elitePool: 1,
          civilServantCount: 0,
          activePopulationCount: 5,
          unemployed: 3,
          unemploymentPercentage: 30,
          lack: 1,
          byGroup: {
            artisans: { workerPool: 6, assigned: 4, unemployed: 2 },
            merchants: { workerPool: 4, assigned: 2, unemployed: 2 },
            scholars: { workerPool: 0, assigned: 0, unemployed: 0 },
          },
          bySector: {
            1: { need: 1 },
            2: { need: 0 },
          },
        },
      };
    }
    return {
      totalPop: 4,
      popByGroup: { artisans: 3, merchants: 1, scholars: 0 },
      famishedPopulation: 1,
      employment: {
        activeCitizenCount: 2,
        elitePool: 0,
        civilServantCount: 0,
        activePopulationCount: 2,
        unemployed: 1,
        unemploymentPercentage: 25,
        lack: 0,
        byGroup: {
          artisans: { workerPool: 3, assigned: 2, unemployed: 1 },
          merchants: { workerPool: 1, assigned: 0, unemployed: 1 },
          scholars: { workerPool: 0, assigned: 0, unemployed: 0 },
        },
        bySector: {},
      },
    };
  }),
}));

jest.unstable_mockModule('../../src/composition/hudResourceAggregates.js', () => ({
  getHudResourceScopeSnapshot: jest.fn(async (scope) => {
    if (scope === 'country') {
      return {
        city: { wheat: 8, carrot: 1, cabbage: 0 },
        commerce: { wood: 10, furniture: 1, figs: 4 },
        cityTotal: 9,
        commerceTotal: 15,
      };
    }
    return {
      city: { wheat: 5, carrot: 0, cabbage: 0 },
      commerce: { wood: 2, furniture: 0, figs: 4 },
      cityTotal: 5,
      commerceTotal: 6,
    };
  }),
}));

const { syncSessionHud } = await import('../../src/composition/syncSessionHud.js');

describe('syncSessionHud', () => {
  test('pop rail uses country totals with active hamlet breakdown', async () => {
    const updatePopulationBreakdown = jest.fn();
    const updateFamishedPopulation = jest.fn();
    const updateGroupHud = jest.fn();
    const updateResourcesHud = jest.fn();

    await syncSessionHud({
      housing: {},
      employment: { getCityEmploymentSummary: async () => ({}) },
      gameUI: {
        updateFamishedPopulation,
        updateDeaths: () => {},
        updateFunds: () => {},
        updatePopulationBreakdown,
        updateGroupHud,
        updateResourcesHud,
      },
      includeEmployment: true,
    });

    expect(updateFamishedPopulation).toHaveBeenCalledWith(2, 1);
    expect(updatePopulationBreakdown).toHaveBeenCalledWith(
      10,
      4,
      1,
      0,
      5,
      {
        totalPop: 4,
        activeCitizenCount: 2,
        elitePool: 0,
        civilServantCount: 0,
        activePopulationCount: 2,
      }
    );
    expect(updateGroupHud).toHaveBeenCalledWith(
      expect.objectContaining({
        popCountry: { artisans: 6, merchants: 4, scholars: 0 },
        popHamlet: { artisans: 3, merchants: 1, scholars: 0 },
        workersCountry: { artisans: 6, merchants: 4, scholars: 0 },
        workersHamlet: { artisans: 3, merchants: 1, scholars: 0 },
        laborCountry: { unemployed: 3, unemploymentPercentage: 30, lack: 1 },
        laborHamlet: { unemployed: 1, unemploymentPercentage: 25, lack: 0 },
      })
    );
    expect(updateGroupHud.mock.calls[0][0].groupsCountry.artisans.lack).toBe(1);
    expect(updateGroupHud.mock.calls[0][0].groupsHamlet.artisans.lack).toBe(0);
    expect(updateResourcesHud).toHaveBeenCalledWith({
      cityCountry: { wheat: 8, carrot: 1, cabbage: 0 },
      cityHamlet: { wheat: 5, carrot: 0, cabbage: 0 },
      commerceCountry: { wood: 10, furniture: 1, figs: 4 },
      commerceHamlet: { wood: 2, furniture: 0, figs: 4 },
    });
  });
});
