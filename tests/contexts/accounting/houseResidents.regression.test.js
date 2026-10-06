import { describe, test, expect } from '@jest/globals';
import { residentsOfHouse } from '../../../src/contexts/accounting/domain/policies/HouseResidentsPolicy.js';

// Every resident of a household is one citizen: where he works, or whether he is a civil servant or unemployed.
describe('household residents — one record per citizen, with his workplace or his status', () => {
  test('24 residents, 10 at work (6 at the mill, 4 at the farm): 2 civil servants and 12 unemployed, each named once', () => {
    const residents = residentsOfHouse({
      houseId: 'house-1',
      pop: 24,
      workplaces: [{ workplaceId: 'mill', workers: 6 }, { workplaceId: 'farm', workers: 4 }],
    });

    expect(residents).toHaveLength(24);
    expect(residents.filter((r) => r.status === 'worker').map((r) => r.workplaceId)).toEqual([
      'mill', 'mill', 'mill', 'mill', 'mill', 'mill', 'farm', 'farm', 'farm', 'farm',
    ]);
    expect(residents.filter((r) => r.status === 'civil_servant')).toHaveLength(2);
    expect(residents.filter((r) => r.status === 'unemployed')).toHaveLength(12);
    expect(new Set(residents.map((r) => r.id)).size).toBe(24);
  });

  test('more workers than residents is refused, never silently cut', () => {
    expect(() => residentsOfHouse({ houseId: 'house-1', pop: 3, workplaces: [{ workplaceId: 'mill', workers: 4 }] })).toThrow(/workers/);
  });
});
