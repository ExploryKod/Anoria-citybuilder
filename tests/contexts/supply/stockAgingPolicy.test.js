import { addAges, expireAges, reconcileAges, shelfLifeTurnsOf, takeOldestAges } from '../../../src/contexts/supply/domain/policies/StockAgingPolicy.js';

describe('shelf life of a stock', () => {
  test('a life is its months in days times the factor of where it is kept, and an infinite life ignores the factor', () => {
    expect(shelfLifeTurnsOf({ shelfLifeMonths: 3, factor: 4, daysPerMonth: 5 })).toBe(60);
    expect(shelfLifeTurnsOf({ shelfLifeMonths: Infinity, factor: 4, daysPerMonth: 5 })).toBe(Infinity);
  });

  test('what is eaten or taken comes off the oldest units first, and what appeared unseen is born now', () => {
    expect(reconcileAges([[0, 6], [10, 4]], 7, 20)).toEqual([[10, 4], [0, 3]].sort(([a], [b]) => a - b));
    expect(reconcileAges([[10, 4]], 9, 20)).toEqual([[10, 4], [20, 5]]);
  });

  test('a transfer carries the age of what it moves: the oldest units go first', () => {
    const { taken, rest } = takeOldestAges([[0, 3], [10, 4]], 5);
    expect(taken).toEqual([[0, 3], [10, 2]]);
    expect(rest).toEqual([[10, 2]]);
    expect(addAges([[10, 1], [30, 2]], taken)).toEqual([[0, 3], [10, 3], [30, 2]]);
  });

  test('a batch that outlived its life is lost, the others are kept', () => {
    expect(expireAges([[0, 3], [40, 2]], 60, 60)).toEqual({ kept: [[40, 2]], lost: 3 });
    expect(expireAges([[0, 3]], 1_000_000, Infinity)).toEqual({ kept: [[0, 3]], lost: 0 });
  });
});
