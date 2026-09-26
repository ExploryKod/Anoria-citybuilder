import { describe, test, expect } from '@jest/globals';
import { formatServicesModel } from '../../../../src/presentation/dom/info/presenters/formats/servicesInfoFormat.js';

function houseVm(overrides = {}) {
  return {
    buildingType: 'House-Red',
    roadAccess: { hasAccess: true, roadCount: 1 },
    supplyView: { marketTooFar: false },
    houseLevel: 1,
    servedFlags: null,
    periodKey: 4,
    ...overrides,
  };
}

describe('servicesInfoFormat — house Services tab chips', () => {
  test('a non-house building only ever gets the Route chip', () => {
    const model = formatServicesModel({
      buildingType: 'Farm-Wheat',
      roadAccess: { hasAccess: true, roadCount: 1 },
    });
    expect(model.items).toEqual([
      expect.objectContaining({ label: 'Route', status: 'ok' }),
    ]);
  });

  test('a tier-1 house shows Route, Marché, and Chapel (unmet — no faith flag yet)', () => {
    const model = formatServicesModel(houseVm({ servedFlags: null }));

    expect(model.items.map((i) => i.label)).toEqual(['Route', 'Étal rouge', 'Foi']);
    const chapelChip = model.items.find((i) => i.label === 'Foi');
    expect(chapelChip).toMatchObject({ emoji: '⛪', status: 'off', value: null });
  });

  test('faith served THIS period flips the Chapel chip to met', () => {
    const model = formatServicesModel(houseVm({ servedFlags: { faith: 4 }, periodKey: 4 }));

    const chapelChip = model.items.find((i) => i.label === 'Foi');
    expect(chapelChip).toMatchObject({ status: 'ok', value: '✓' });
  });

  test('a flag within faith\'s coverage window (coveragePeriods: 2) still reads as met', () => {
    const model = formatServicesModel(houseVm({ servedFlags: { faith: 3 }, periodKey: 4 }));

    const chapelChip = model.items.find((i) => i.label === 'Foi');
    expect(chapelChip).toMatchObject({ status: 'ok', value: '✓' });
  });

  test('once the gap reaches coveragePeriods, the flag reads as unmet — not a permanent "reached" toggle', () => {
    const model = formatServicesModel(houseVm({ servedFlags: { faith: 2 }, periodKey: 4 }));

    const chapelChip = model.items.find((i) => i.label === 'Foi');
    expect(chapelChip).toMatchObject({ status: 'off', value: null });
  });

  test('a tier-2 house shows Chapel (met) AND Doctor (the next thing it needs)', () => {
    const model = formatServicesModel(
      houseVm({ houseLevel: 2, servedFlags: { faith: 4 }, periodKey: 4 }),
    );

    expect(model.items.map((i) => i.label)).toEqual(['Route', 'Étal rouge', 'Foi', 'Soins médicaux']);
    expect(model.items.find((i) => i.label === 'Foi')).toMatchObject({ status: 'ok' });
    expect(model.items.find((i) => i.label === 'Soins médicaux')).toMatchObject({ status: 'off' });
  });
});
