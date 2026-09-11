import { describe, test, expect } from '@jest/globals';
import { formatMessagesModel } from '../../../../src/presentation/dom/info/presenters/formats/messagesInfoFormat.js';

/** @param {Partial<import('../../../../src/presentation/dom/info/buildingInfoTypes.js').BuildingInfoViewModel>} overrides */
function vm(overrides = {}) {
  return {
    lastConsumption: null,
    ...overrides,
  };
}

describe('formatMessagesModel', () => {
  test('no complaint when there is no consumption record at all (non-house buildings)', () => {
    expect(formatMessagesModel(vm())).toEqual({ complaints: [] });
  });

  test('no complaint when everyone was fed this period', () => {
    const model = formatMessagesModel(vm({ lastConsumption: { month: 4, totalUnfed: 0 } }));
    expect(model).toEqual({ complaints: [] });
  });

  test('singular complaint for exactly one unfed citizen', () => {
    const model = formatMessagesModel(vm({ lastConsumption: { month: 4, totalUnfed: 1 } }));
    expect(model.complaints).toEqual(["1 d'entre nous est affamé"]);
  });

  test('plural complaint, phrased as a citizen grievance rather than a status readout', () => {
    const model = formatMessagesModel(vm({ lastConsumption: { month: 4, totalUnfed: 10 } }));
    expect(model.complaints).toEqual(["10 d'entre nous sommes affamés"]);
  });
});
