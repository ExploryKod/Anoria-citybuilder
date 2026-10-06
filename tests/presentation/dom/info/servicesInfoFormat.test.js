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

  test('a tier-1 house shows Route, Marché, its own business access, and Chapel (unmet — no faith flag yet)', () => {
    const model = formatServicesModel(houseVm({ servedFlags: null }));

    expect(model.items.map((i) => i.label)).toEqual(['Route', 'Étal rouge', 'Entrepôt (activité)', 'Foi']);
    const chapelChip = model.items.find((i) => i.label === 'Foi');
    expect(chapelChip).toMatchObject({ emoji: '⛪', status: 'off', value: 'inexistant' });
  });

  test('a house running a business (House-Red) shows whether it can reach a hub for it', () => {
    const reachable = formatServicesModel(houseVm({ activitySupplyGaps: [] }));
    expect(reachable.items.find((i) => i.label === 'Entrepôt (activité)')).toMatchObject({ status: 'ok', value: '✓' });

    const blocked = formatServicesModel(
      houseVm({ activitySupplyGaps: [{ category: 'decoratedPot', inputCategory: 'pot', role: 'hub', status: 'no-hub' }] })
    );
    expect(blocked.items.find((i) => i.label === 'Entrepôt (activité)')).toMatchObject({ status: 'off', value: null });
  });

  test('a gap that is only "nothing supplies the hub" (no-supplier) does not count against warehouse access', () => {
    const model = formatServicesModel(
      houseVm({ activitySupplyGaps: [{ category: 'decoratedPot', inputCategory: 'pot', role: 'hub', status: 'no-supplier' }] })
    );
    expect(model.items.find((i) => i.label === 'Entrepôt (activité)')).toMatchObject({ status: 'ok', value: '✓' });
  });

  test('a non-house building never gets the business-access chip, even with gaps', () => {
    const model = formatServicesModel({
      buildingType: 'Farm-Wheat',
      roadAccess: { hasAccess: true, roadCount: 1 },
      activitySupplyGaps: [{ category: 'x', inputCategory: 'y', role: 'hub', status: 'no-hub' }],
    });
    expect(model.items.some((i) => i.label === 'Entrepôt (activité)')).toBe(false);
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
    expect(chapelChip).toMatchObject({ status: 'off', value: 'inexistant' });
  });

  test('a tier-2 house shows Chapel (met) AND Doctor (the next thing it needs)', () => {
    const model = formatServicesModel(
      houseVm({ houseLevel: 2, servedFlags: { faith: 4 }, periodKey: 4 }),
    );

    expect(model.items.map((i) => i.label)).toEqual(['Route', 'Étal rouge', 'Entrepôt (activité)', 'Foi', 'Soins médicaux']);
    expect(model.items.find((i) => i.label === 'Foi')).toMatchObject({ status: 'ok' });
    expect(model.items.find((i) => i.label === 'Soins médicaux')).toMatchObject({ status: 'off' });
  });
});
