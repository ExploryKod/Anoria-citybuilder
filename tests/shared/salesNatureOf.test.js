import { describe, test, expect } from '@jest/globals';
import { salesNatureOf } from '../../src/shared/building-catalog/resourceRoleQueries.js';

// A building's sales are filed by what the catalog declares it does: a warehouse is not a factory, a school is not a shop.
describe('salesNatureOf — what a building sells, from the catalog', () => {
  test.each([
    ['Warehouse', 'merchandise'],
    ['TradeWarehouse', 'merchandise'],
    ['Market-Stall-Red', 'merchandise'],
    ['Farm-Wheat', 'production'],
    ['Factory-Pot', 'production'],
    ['WaterTank', 'services'],
    ['CoalPlant', 'services'],
    ['School', 'services'],
    ['Hospital', 'services'],
    ['FireStation', 'services'],
  ])('%s sells %s', (type, nature) => {
    expect(salesNatureOf(type)).toBe(nature);
  });

  test('a building the catalog gives no role says nothing (null), it is not guessed', () => {
    expect(salesNatureOf('Bank')).toBeNull();
  });
});
