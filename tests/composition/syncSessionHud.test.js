import { describe, expect, test, jest } from '@jest/globals';
import { syncSessionHud } from '../../src/composition/syncSessionHud.js';

describe('syncSessionHud', () => {
  test('HUD total population uses Housing residents, not Employment labor pool', async () => {
    const updatePopulationBreakdown = jest.fn();

    await syncSessionHud({
      housing: {
        getFamishedPopulation: async () => ({ famishedPopulation: 0 }),
        getCityPopulationSummary: async () => ({ totalPop: 1 }),
      },
      employment: {
        getCityEmploymentSummary: async () => ({
          totalPopulation: 0,
          activeCitizenCount: 0,
          elitePool: 0,
          civilServantCount: 0,
          activePopulationCount: 0,
          unemployed: 0,
          unemploymentPercentage: 0,
          lack: 0,
        }),
      },
      gameUI: {
        updateFamishedPopulation: () => {},
        updateFunds: () => {},
        updatePopulationBreakdown,
        updateUnemployedPopulation: () => {},
        updateWorkerLack: () => {},
      },
      includeEmployment: true,
    });

    expect(updatePopulationBreakdown).toHaveBeenCalledWith(1, 0, 0, 0, 0);
  });
});
