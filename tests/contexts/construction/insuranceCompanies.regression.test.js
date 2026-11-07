import { describe, test, expect } from '@jest/globals';
import { PlaceBuildingWithPayment } from '../../../src/contexts/construction/application/services/PlaceBuildingWithPayment.js';
import { nextFreeCompanyId } from '../../../src/shared/building-catalog/buildingCompanies.js';
import { getBuildingDefinition } from '../../../src/shared/building-catalog/buildingCatalog.js';
import { INSURANCE_COMPANIES } from '../../../src/shared/asset-economy/insuranceCompanies.js';

// One insurance building is one company of the catalog's list: it takes the first place no standing building holds, the construction is limited to as many,
// and the place of a company whose building is gone is free again.
const [FIRST, SECOND] = INSURANCE_COMPANIES.map((company) => company.id);

function placer(standing = []) {
  const rows = [...standing];
  const placeBuilding = new PlaceBuildingWithPayment({
    repository: {
      findById: async () => null,
      listAllRows: async () => rows,
      addRecord: async (data) => {
        rows.push(data);
        return { success: true, instanceId: data.instanceId };
      },
    },
    recordExpense: async () => ({ success: true, budget: 0 }),
    recordRefund: async () => ({ success: true }),
  });
  return { rows, place: () => placeBuilding.execute({ type: 'Insurance', price: 140 }) };
}

describe('insurance companies — one building, one company of the catalog', () => {
  test('the construction is limited to as many buildings as the catalog lists companies', () => {
    expect(getBuildingDefinition('Insurance').maxPerHamlet).toBe(INSURANCE_COMPANIES.length);
  });

  test('each building placed takes the next company of the list', async () => {
    const { rows, place } = placer();

    await place();
    await place();

    expect(rows.map((row) => row.companyId)).toEqual([FIRST, SECOND]);
  });

  test('the place of a company whose building was demolished is free again, whichever it was', async () => {
    expect(nextFreeCompanyId('Insurance', [SECOND])).toBe(FIRST);
    const { rows, place } = placer([{ type: 'Insurance', companyId: SECOND }]);

    await place();

    expect(rows.map((row) => row.companyId)).toEqual([SECOND, FIRST]);
  });

  test('with every company standing, a third building is not placed: it throws, and nothing is paid for it', async () => {
    expect(() => nextFreeCompanyId('Insurance', [FIRST, SECOND])).toThrow(/already stands/);
    const { rows, place } = placer([{ type: 'Insurance', companyId: FIRST }, { type: 'Insurance', companyId: SECOND }]);

    const result = await place();

    expect(result.success).toBe(false);
    expect(rows).toHaveLength(2);
  });
});
