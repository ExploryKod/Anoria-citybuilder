import { foodForecastOf } from '../../../src/contexts/supply/domain/policies/FoodForecastPolicy.js';

describe('food forecast — too many farms, granaries too small, farms idle', () => {
  test('six carrot fields for 66 citizens: a surplus, and what the granary ceiling cannot hold may go bad', () => {
    const forecast = foodForecastOf({
      harvestByCategory: { carrot: 1728 },
      plantedByCategory: { carrot: 1728 },
      demand: 792,
      storage: { byCategory: { carrot: 864 }, total: 2880 },
    });
    expect(forecast).toMatchObject({ judged: true, harvest: 1728, kept: 864, surplus: 936, spoilRisk: 864, unkeepable: 0 });
  });

  test('exactly the harvest the citizens eat, but granaries that keep only part of it: the meals cannot last the year', () => {
    const forecast = foodForecastOf({ harvestByCategory: { wheat: 792 }, plantedByCategory: { wheat: 792 }, demand: 792, storage: { byCategory: { wheat: 500 }, total: 2880 } });
    expect(forecast).toMatchObject({ surplus: 0, unkeepable: 292, spoilRisk: 292 });
  });

  test('nothing is judged while nobody lives in the city', () => {
    const forecast = foodForecastOf({ harvestByCategory: { wheat: 288 }, plantedByCategory: { wheat: 288 }, demand: 0, storage: { byCategory: {}, total: 0 } });
    expect(forecast).toMatchObject({ judged: false, surplus: 0, spoilRisk: 0, unkeepable: 0 });
  });

  // Regression: six fields stood but no one worked them (the sick, no farmers); the forecast promised 1728 baskets for 432 eaten, and blamed the granaries.
  test('farms no one works at harvest nothing: no surplus is promised, and the granary that has the room is not blamed', () => {
    const forecast = foodForecastOf({
      harvestByCategory: {},
      plantedByCategory: { carrot: 864, wheat: 864 },
      demand: 432,
      storage: { byCategory: { carrot: 2880, wheat: 2880 }, total: 2880 },
    });
    expect(forecast).toMatchObject({ judged: true, harvest: 0, potential: 1728, surplus: 0, spoilRisk: 0, unkeepable: 0 });
  });
});
