import { describe, test, expect } from '@jest/globals';
import { payableServiceBills } from '../../../src/contexts/accounting/domain/policies/ServiceSolvencyPolicy.js';

// A house pays its service bills in order while its money covers them; the first it cannot pay cuts off its other services.
describe('service solvency — an insolvent house is cut off from its services for the month', () => {
  test('a house pays its bills while its money covers them, and the bill it cannot pay cuts off its later ones', () => {
    const funds = { house: 100, poor: 5 };
    const bills = [
      { houseId: 'house', amount: 60 },
      { houseId: 'house', amount: 50 },
      { houseId: 'house', amount: 10 },
      { houseId: 'poor', amount: 10 },
    ];

    expect(payableServiceBills(bills, (houseId) => funds[houseId])).toEqual([true, false, false, false]);
  });

  test('a fully subsidised service is always paid, even by a house with no money', () => {
    const bills = [{ houseId: 'poor', amount: 0 }];

    expect(payableServiceBills(bills, () => -20)).toEqual([true]);
  });
});
