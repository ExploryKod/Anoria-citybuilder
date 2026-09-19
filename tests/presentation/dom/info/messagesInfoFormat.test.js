import { describe, test, expect } from '@jest/globals';
import { formatMessagesModel } from '../../../../src/presentation/dom/info/presenters/formats/messagesInfoFormat.js';

/** @param {Partial<import('../../../../src/presentation/dom/info/buildingInfoTypes.js').BuildingInfoViewModel>} overrides */
function vm(overrides = {}) {
  return {
    buildingType: 'House-Blue',
    lastConsumption: null,
    buildingRow: null,
    ...overrides,
  };
}

/** @param {{ roads?: number, worker?: number, workerNeed?: number }} params */
function workplaceVm(buildingType, { roads = 1, worker = 2, workerNeed = 2 } = {}) {
  return vm({
    buildingType,
    buildingRow: {
      roads,
      employees: { worker, worker_need: workerNeed, elite: 0, elite_need: 0, sector: 6 },
    },
  });
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

describe('formatMessagesModel — personnel complaints (moved off the Staff tab banner)', () => {
  test('no complaint for a non-workplace building (no employees on the row at all)', () => {
    expect(formatMessagesModel(vm()).complaints).toEqual([]);
  });

  test('no complaint when fully staffed', () => {
    const model = formatMessagesModel(workplaceVm('Doctor', { worker: 2, workerNeed: 2 }));
    expect(model.complaints).toEqual([]);
  });

  test('complains about no road before even looking at staffing', () => {
    const model = formatMessagesModel(workplaceVm('Doctor', { roads: 0, worker: 2, workerNeed: 2 }));
    expect(model.complaints).toEqual(['Aucune route ne dessert ce lieu, personne ne peut venir y travailler']);
  });

  test('a farm is exempt from the road complaint (same rule the old banner used)', () => {
    const model = formatMessagesModel(workplaceVm('Farm-Wheat', { roads: 0, worker: 0, workerNeed: 3 }));
    expect(model.complaints).toEqual(["Nous manquons de personnel, l'activité est totalement à l'arrêt"]);
  });

  test('zero workers complains harder than a partial staff', () => {
    const none = formatMessagesModel(workplaceVm('Doctor', { worker: 0, workerNeed: 2 }));
    expect(none.complaints).toEqual(["Nous manquons de personnel, l'activité est totalement à l'arrêt"]);

    const partial = formatMessagesModel(workplaceVm('Doctor', { worker: 1, workerNeed: 2 }));
    expect(partial.complaints).toEqual(['Nous manquons de personnel pour fonctionner à plein régime']);
  });
});

describe('formatMessagesModel — market supply-chain complaints (moved off the État tab)', () => {
  function marketVm({ noFarmsNearby = false, hasHousesNearby = true, ...staffing } = {}) {
    return {
      ...workplaceVm('Market-Stall', staffing),
      supplyView: { kind: 'market', noFarmsNearby, hasHousesNearby },
    };
  }

  test('no complaint when fully supplied and staffed', () => {
    expect(formatMessagesModel(marketVm()).complaints).toEqual([]);
  });

  test('not a market (no supplyView.kind === "market") never gets market complaints', () => {
    const model = formatMessagesModel(workplaceVm('Doctor'));
    expect(model.complaints).toEqual([]);
  });

  test('complains when no farms feed it', () => {
    const model = formatMessagesModel(marketVm({ noFarmsNearby: true }));
    expect(model.complaints).toEqual(['Aucune ferme ne nous approvisionne']);
  });

  test('complains when no houses are in reach', () => {
    const model = formatMessagesModel(marketVm({ hasHousesNearby: false }));
    expect(model.complaints).toEqual(["Aucune maison n'est à portée de nos étals"]);
  });

  test('stacks with the generic personnel complaint (a market is a workplace too)', () => {
    const model = formatMessagesModel(marketVm({ noFarmsNearby: true, worker: 0, workerNeed: 2 }));
    expect(model.complaints).toEqual([
      "Nous manquons de personnel, l'activité est totalement à l'arrêt",
      'Aucune ferme ne nous approvisionne',
    ]);
  });
});
