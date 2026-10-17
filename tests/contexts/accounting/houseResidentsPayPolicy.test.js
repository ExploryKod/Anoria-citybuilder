import { describe, test, expect } from '@jest/globals';
import { residentPayBreakdownOf } from '../../../src/contexts/accounting/domain/policies/HouseResidentsPayPolicy.js';
import { residentsOfHouse } from '../../../src/contexts/accounting/domain/policies/HouseResidentsPolicy.js';

const period = { houseId: 'house-1', year: 2024, month: 6 };

// A resident's pay is a split of the journal's booked line, never a second computation: the group sums back exactly.
describe('resident pay breakdown — a split of the journal, never a new figure', () => {
  test('three workers at the same workplace split their booked line exactly, the last absorbing the centime', () => {
    const residents = residentsOfHouse({ houseId: 'house-1', pop: 3, salaried: 0, workplaces: [{ workplaceId: 'mill', workers: 3 }] });
    const journalEntries = [
      { type: 'household_wage', amount: 10, year: 2024, month: 6, accountBuildingId: 'house-1', accountKind: 'particulier', counterpartyBuildingId: 'mill' },
    ];
    const breakdown = residentPayBreakdownOf(residents, journalEntries, period, { predictedBenefit: 0, predictedStipend: 0 });
    expect(breakdown).toEqual([
      { id: 'house-1:0', amount: 3.33, settled: true },
      { id: 'house-1:1', amount: 3.33, settled: true },
      { id: 'house-1:2', amount: 3.34, settled: true },
    ]);
    expect(breakdown.reduce((sum, r) => sum + r.amount, 0)).toBeCloseTo(10, 2);
  });

  test('workers at two different workplaces each split only their own workplace line, never pooled', () => {
    const residents = residentsOfHouse({
      houseId: 'house-1',
      pop: 2,
      salaried: 0,
      workplaces: [{ workplaceId: 'mill', workers: 1 }, { workplaceId: 'farm', workers: 1 }],
    });
    const journalEntries = [
      { type: 'household_wage', amount: 20, year: 2024, month: 6, accountBuildingId: 'house-1', accountKind: 'particulier', counterpartyBuildingId: 'mill' },
      { type: 'household_wage', amount: 5, year: 2024, month: 6, accountBuildingId: 'house-1', accountKind: 'particulier', counterpartyBuildingId: 'farm' },
    ];
    const breakdown = residentPayBreakdownOf(residents, journalEntries, period, { predictedBenefit: 0, predictedStipend: 0 });
    expect(breakdown).toEqual([
      { id: 'house-1:0', amount: 20, settled: true },
      { id: 'house-1:1', amount: 5, settled: true },
    ]);
  });

  test('unemployed with no household_benefit line yet, and a positive reference salary, are reported unsettled — never zero', () => {
    const residents = residentsOfHouse({ houseId: 'house-1', pop: 12, salaried: 0, workplaces: [] });
    const breakdown = residentPayBreakdownOf(residents, [], period, { predictedBenefit: 100, predictedStipend: 0 });
    const unemployed = breakdown.find((r) => r.id === residents.find((res) => res.status === 'unemployed').id);
    expect(unemployed).toEqual({ id: unemployed.id, amount: null, settled: false });
  });

  test('unemployed with no household_benefit line, but a nil benefit rate, are a legitimate zero — not unsettled', () => {
    const residents = residentsOfHouse({ houseId: 'house-1', pop: 11, salaried: 0, workplaces: [] });
    const breakdown = residentPayBreakdownOf(residents, [], period, { predictedBenefit: 0, predictedStipend: 0 });
    const unemployed = breakdown.filter((r) => residents.find((res) => res.id === r.id).status === 'unemployed');
    expect(unemployed.every((r) => r.amount === 0 && r.settled === true)).toBe(true);
  });

  // The administrators' pay is the stipend the hamlet booked for the house (`public_wage`), shared evenly among them.
  test('the administrators share the stipend booked for the house, and an unbooked one is unsettled', () => {
    const residents = residentsOfHouse({ houseId: 'house-1', pop: 3, salaried: 3, workplaces: [] });
    const booked = [{ type: 'public_wage', amount: 24, year: 2024, month: 6, accountBuildingId: 'house-1', accountKind: 'particulier', counterpartyBuildingId: null }];

    expect(residentPayBreakdownOf(residents, booked, period, { predictedBenefit: 0, predictedStipend: 24 }).map((r) => r.amount)).toEqual([8, 8, 8]);
    expect(residentPayBreakdownOf(residents, [], period, { predictedBenefit: 0, predictedStipend: 24 }).every((r) => r.amount === null && r.settled === false)).toBe(true);
  });
});
