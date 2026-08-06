import { describe, test, expect } from '@jest/globals';
import { formatHouseDietModel } from '../../../../src/presentation/dom/info/presenters/formats/houseInfoFormat.js';

/** @param {Partial<import('../../../../src/presentation/dom/info/buildingInfoTypes.js').BuildingInfoViewModel>} overrides */
function houseVm(overrides = {}) {
  return {
    buildingType: 'House-Red',
    buildingPop: 2,
    houseLevel: 2,
    stocks: { food: 0, fruit: 0, game: 0, wheat: 0, carrot: 0, cabbage: 0 },
    lastConsumption: null,
    ...overrides,
  };
}

describe('formatHouseDietModel', () => {
  test('exposes zero shortages before any consumption month', () => {
    const model = formatHouseDietModel(houseVm({ houseLevel: 2 }));

    expect(model.shortages).toEqual({
      month: null,
      totalUnfed: 0,
      unfed: {
        fruit: 0,
        game: 0,
        wheat: 0,
        carrot: 0,
        cabbage: 0,
      },
    });
  });

  test('level 1 house only tracks subsistence shortages', () => {
    const model = formatHouseDietModel(houseVm({ houseLevel: 1 }));

    expect(model.shortages.unfed).toEqual({
      fruit: 0,
      game: 0,
    });
    expect(model.shortages.totalUnfed).toBe(0);
  });

  test('merges last consumption shortages while keeping zero-valued types', () => {
    const model = formatHouseDietModel(houseVm({
      lastConsumption: {
        month: 4,
        consumed: { fruit: 1, game: 0, wheat: 0, carrot: 0, cabbage: 0 },
        unfed: { fruit: 0, game: 0.5, wheat: 0, carrot: 0, cabbage: 0 },
        totalUnfed: 1,
      },
    }));

    expect(model.shortages).toEqual({
      month: 4,
      totalUnfed: 1,
      unfed: {
        fruit: 0,
        game: 0.5,
        wheat: 0,
        carrot: 0,
        cabbage: 0,
      },
    });
  });
});
