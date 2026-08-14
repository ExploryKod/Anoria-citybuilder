import { describe, expect, test, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/composition/hudPopulationAggregates.js', () => ({
  getHudPopulationScopeSnapshot: jest.fn(async (scope) => {
    if (scope === 'country') {
      return {
        totalPop: 10,
        famishedPopulation: 2,
        employment: {
          activeCitizenCount: 4,
          elitePool: 1,
          civilServantCount: 0,
          activePopulationCount: 5,
          unemployed: 3,
          unemploymentPercentage: 30,
          lack: 1,
        },
      };
    }
    return {
      totalPop: 4,
      famishedPopulation: 1,
      employment: {
        activeCitizenCount: 2,
        elitePool: 0,
        civilServantCount: 0,
        activePopulationCount: 2,
        unemployed: 1,
        unemploymentPercentage: 25,
        lack: 0,
      },
    };
  }),
}));

const { syncSessionHud } = await import('../../src/composition/syncSessionHud.js');

describe('syncSessionHud', () => {
  test('pop rail uses country totals with active hamlet breakdown', async () => {
    const updatePopulationBreakdown = jest.fn();
    const updateFamishedPopulation = jest.fn();
    const updateUnemployedPopulation = jest.fn();
    const updateWorkerLack = jest.fn();

    await syncSessionHud({
      housing: {},
      employment: { getCityEmploymentSummary: async () => ({}) },
      gameUI: {
        updateFamishedPopulation,
        updateDeaths: () => {},
        updateFunds: () => {},
        updatePopulationBreakdown,
        updateUnemployedPopulation,
        updateWorkerLack,
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
    expect(updateUnemployedPopulation).toHaveBeenCalledWith(3, 30, 1, 25);
    expect(updateWorkerLack).toHaveBeenCalledWith(1, 0);
  });
});
