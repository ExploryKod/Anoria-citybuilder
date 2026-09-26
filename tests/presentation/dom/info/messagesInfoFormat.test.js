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
      employees: { worker, worker_need: workerNeed, sector: 6 },
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

describe('formatMessagesModel — why an unstaffed workplace stays empty', () => {
  /** A farm asks for the "fermier" skill, which the catalog gives to artisan houses from tier 2. */
  const farmVm = (byGroup) => ({
    ...workplaceVm('Farm-Wheat', { roads: 0, worker: 0, workerNeed: 3 }),
    employmentSummary: { byGroup },
  });
  const noWorkerAvailable = "Nous manquons de personnel, l'activité est totalement à l'arrêt";

  test('says a group has no house at all when none stands', () => {
    const [complaint] = formatMessagesModel(farmVm({ artisans: { workerPool: 0, assigned: 0, unemployed: 0 } })).complaints;
    expect(complaint).toBe(`${noWorkerAvailable} — aucune maison pour les Artisans-ouvriers : il en faut pour pourvoir ce poste`);
  });

  test('says everyone of the group already works, and more houses are needed', () => {
    const [complaint] = formatMessagesModel(farmVm({ artisans: { workerPool: 36, assigned: 36, unemployed: 0 } })).complaints;
    expect(complaint).toBe(
      `${noWorkerAvailable} — tous les Artisans-ouvriers ont déjà un emploi : il faut plus de maisons pour les Artisans-ouvriers`
    );
  });

  test('says unemployed residents lack the skill yet, and at which house tier it comes', () => {
    const [complaint] = formatMessagesModel(farmVm({ artisans: { workerPool: 36, assigned: 30, unemployed: 6 } })).complaints;
    expect(complaint).toMatch(/des Artisans-ouvriers sont sans emploi, mais leurs maisons n'ont pas encore la compétence « .+ » \(niveau 2 requis\)$/);
  });

  test('keeps the plain complaint when the city\'s employment was not read', () => {
    const model = formatMessagesModel(workplaceVm('Farm-Wheat', { roads: 0, worker: 0, workerNeed: 3 }));
    expect(model.complaints).toEqual([noWorkerAvailable]);
  });

  test('a partial staff gets the reason too', () => {
    const model = formatMessagesModel({
      ...workplaceVm('Farm-Wheat', { roads: 0, worker: 1, workerNeed: 3 }),
      employmentSummary: { byGroup: { artisans: { workerPool: 36, assigned: 36, unemployed: 0 } } },
    });
    expect(model.complaints[0]).toMatch(/^Nous manquons de personnel pour fonctionner à plein régime — tous les /);
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
    // The goods are the ones the market's own catalog entry sells.
    expect(model.complaints).toEqual(['Aucun approvisionnement : Blé, Carotte, Chou']);
  });

  test('complains when no houses are in reach', () => {
    const model = formatMessagesModel(marketVm({ hasHousesNearby: false }));
    expect(model.complaints).toEqual([expect.stringMatching(/^Aucune maison à portée : /)]);
  });

  test('stacks with the generic personnel complaint (a market is a workplace too)', () => {
    const model = formatMessagesModel(marketVm({ noFarmsNearby: true, worker: 0, workerNeed: 2 }));
    expect(model.complaints).toEqual([
      "Nous manquons de personnel, l'activité est totalement à l'arrêt",
      'Aucun approvisionnement : Blé, Carotte, Chou',
    ]);
  });
});
