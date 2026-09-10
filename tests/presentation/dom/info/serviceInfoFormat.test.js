import { describe, test, expect } from '@jest/globals';
import {
  formatServiceLayoutHeader,
  formatServiceOverviewModel,
  formatServiceStaffModel,
} from '../../../../src/presentation/dom/info/presenters/formats/serviceInfoFormat.js';

const fakeEmployment = {
  getSectorPriority: () => 2,
  getSectorName: () => 'Services Publics',
};

function vmFor(buildingType, { roads = 1, worker = 0, workerNeed = 2 } = {}) {
  return {
    buildingType,
    anchorX: 3,
    anchorY: 4,
    buildingPop: 0,
    buildingRow: {
      roads,
      employees: { worker, worker_need: workerNeed, elite: 0, elite_need: 0, sector: 6 },
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

  test('no road access blocks service, independent of staffing', () => {
    const model = formatServiceOverviewModel(vmFor('Chapel', { roads: 0, worker: 2 }));
    expect(model.sections[0].rows[0]).toEqual({ label: 'État', value: expect.stringContaining('Route nécessaire') });
  });

  test('road but no workers reports inactive; fully staffed reports in service', () => {
    const understaffed = formatServiceOverviewModel(vmFor('Chapel', { roads: 1, worker: 0, workerNeed: 2 }));
    expect(understaffed.sections[0].rows[0].value).toContain('Inactif');

    const staffed = formatServiceOverviewModel(vmFor('Chapel', { roads: 1, worker: 2, workerNeed: 2 }));
    expect(staffed.sections[0].rows[0].value).toContain('En service');
  });

  test('staff tab banner text is derived from the building displayName, not hardcoded per building', () => {
    const chapelStaff = formatServiceStaffModel(vmFor('Chapel', { worker: 0, workerNeed: 2 }));
    const doctorStaff = formatServiceStaffModel(vmFor('Doctor', { worker: 0, workerNeed: 2 }));

    expect(chapelStaff.sections[0].banners[0].text).toContain('Chapelle');
    expect(doctorStaff.sections[0].banners[0].text).toContain('Cabinet médical');
  });
});
