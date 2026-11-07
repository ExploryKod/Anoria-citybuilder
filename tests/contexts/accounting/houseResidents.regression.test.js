import { describe, test, expect } from '@jest/globals';
import { residentsOfHouse } from '../../../src/contexts/accounting/domain/policies/HouseResidentsPolicy.js';
import { citizenId, fakeCitizens } from '../../helpers/citizens.js';

// Every resident of a household is one citizen: where he works (his own workplaceId), whether the hamlet pays him (an administrator), or whether he is unemployed.
// Civil servants were removed (2026-10-10, "suppress it for now").
describe('household residents — one record per citizen, with his workplace or his status', () => {
  test('24 residents, 10 at work (6 at the mill, 4 at the farm): 14 unemployed, each one a stored citizen', () => {
    const citizens = fakeCitizens(24, [{ workplaceId: 'mill', workers: 6 }, { workplaceId: 'farm', workers: 4 }]);
    const residents = residentsOfHouse({ houseId: 'house-1', citizens, seeksWork: true });

    expect(residents).toHaveLength(24);
    expect(residents.filter((r) => r.status === 'worker').map((r) => r.workplaceId)).toEqual([
      'mill', 'mill', 'mill', 'mill', 'mill', 'mill', 'farm', 'farm', 'farm', 'farm',
    ]);
    expect(residents.filter((r) => r.status === 'unemployed')).toHaveLength(14);
    expect(residents.map((r) => r.id)).toEqual(fakeCitizens(24).map((citizen) => citizen.id));
    expect(residents[0]).toMatchObject({ id: citizenId(0), firstName: 'Habitant 0' });
  });

  // Regression: the house of the administrators showed "3 sans emploi" — its residents look for no job, the hamlet pays them a stipend.
  test('the residents the hamlet pays are administrators, never unemployed', () => {
    const residents = residentsOfHouse({ houseId: 'mayor', citizens: fakeCitizens(3), seeksWork: false });

    expect(residents.map((r) => r.status)).toEqual(['administrator', 'administrator', 'administrator']);
    expect(residents.some((r) => r.status === 'unemployed')).toBe(false);
  });

  test('a resident employed in a household that looks for no job is refused, never silently shown as an administrator', () => {
    expect(() => residentsOfHouse({ houseId: 'mayor', citizens: fakeCitizens(2, [{ workplaceId: 'mill', workers: 1 }]), seeksWork: false })).toThrow(/look for no job/);
  });
});
