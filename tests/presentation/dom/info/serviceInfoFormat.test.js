import { describe, test, expect } from '@jest/globals';
import {
  formatServiceLayoutHeader,
  formatServiceOverviewModel,
  formatServiceStaffModel,
} from '../../../../src/presentation/dom/info/presenters/formats/serviceInfoFormat.js';

const fakeEmployment = {
  getSkillPriority: () => 2,
  getSectorName: () => 'Services Publics',
  getStaffingGroups: () => ({ groups: [{ group: 'scholars', tier: 1 }], openToAll: false }),
};

function vmFor(buildingType, { roads = 1, worker = 0, workerNeed = 2 } = {}) {
  return {
    buildingType,
    anchorX: 3,
    anchorY: 4,
    buildingPop: 0,
    buildingRow: {
      roads,
      employees: { worker, worker_need: workerNeed, sector: 6 },
    },
    employment: fakeEmployment,
  };
}

describe('serviceInfoFormat — one generic format, driven entirely by catalog facts', () => {
  test('Chapel and Doctor get distinct, catalog-derived content with zero building-specific code', () => {
    const chapel = formatServiceOverviewModel(vmFor('Chapel', { worker: 2 }));
    const doctor = formatServiceOverviewModel(vmFor('Doctor', { worker: 2 }));

    expect(chapel.sections[0].title).toBe('État — Chapelle');
    expect(chapel.sections[0].rows).toContainEqual({ label: 'Service rendu', value: 'Foi' });

    expect(doctor.sections[0].title).toBe('État — Cabinet médical');
    expect(doctor.sections[0].rows).toContainEqual({ label: 'Service rendu', value: 'Soins médicaux' });
  });

  test('header title comes from the catalog displayName, not the raw type id', () => {
    expect(formatServiceLayoutHeader(vmFor('Chapel')).title).toBe('Chapelle');
  });

  test('reports catalog reference facts only — road/staffing status moved to Messages, not repeated here', () => {
    const noRoad = formatServiceOverviewModel(vmFor('Chapel', { roads: 0, worker: 2 }));
    const understaffed = formatServiceOverviewModel(vmFor('Chapel', { roads: 1, worker: 0, workerNeed: 2 }));
    const staffed = formatServiceOverviewModel(vmFor('Chapel', { roads: 1, worker: 2, workerNeed: 2 }));

    // Same reference facts regardless of operational state — the row set
    // doesn't change with road/staffing, only the catalog-derived content.
    for (const model of [noRoad, understaffed, staffed]) {
      expect(model.sections[0].rows).toEqual([
        { label: 'Service rendu', value: 'Foi' },
        { label: 'Portée', value: 'illimitée' },
      ]);
    }
  });

  test('staff tab reports staffing numbers only — no "lack of personnel" banner (that\'s a Messages-tab complaint now)', () => {
    const understaffed = formatServiceStaffModel(vmFor('Chapel', { worker: 0, workerNeed: 2 }));

    // The label names the category the catalog expects, as its house is named in the catalog.
    expect(understaffed.sections[0].rows).toContainEqual({ label: 'Ouvriers · Savants', value: '0/2' });
    expect(understaffed.sections[0].banners).toBeUndefined();
  });

  test('a workplace every social category can fill just says "Employés"', () => {
    const vm = {
      ...vmFor('Chapel', { worker: 1, workerNeed: 2 }),
      employment: {
        ...fakeEmployment,
        getStaffingGroups: () => ({
          groups: [{ group: 'artisans', tier: 1 }, { group: 'merchants', tier: 1 }, { group: 'scholars', tier: 1 }],
          openToAll: true,
        }),
      },
    };

    expect(formatServiceStaffModel(vm).sections[0].rows).toContainEqual({ label: 'Employés', value: '1/2' });
  });
});
