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
  test('exposes zero shortage before any consumption month', () => {
    const model = formatHouseDietModel(houseVm());

    expect(model.shortages).toEqual({ month: null, totalUnfed: 0 });
  });

  test('reports total unfed from last consumption, regardless of house level', () => {
    const model = formatHouseDietModel(houseVm({
      lastConsumption: { month: 4, totalUnfed: 1 },
    }));

    expect(model.shortages).toEqual({ month: 4, totalUnfed: 1 });
  });
});
