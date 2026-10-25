import { describe, test, expect } from '@jest/globals';
import { formatServicesModel } from '../../../../src/presentation/dom/info/presenters/formats/servicesInfoFormat.js';

function houseVm(overrides = {}) {
  return {
    buildingType: 'House-Red',
    roadAccess: { hasAccess: true, roadCount: 1 },
    supplyView: { marketTooFar: false },
    houseLevel: 1,
    buildingPop: 1,
    servedFlags: null,
    periodKey: 4,
    ...overrides,
  };
}

describe('servicesInfoFormat — informative chips (items)', () => {
  test('a non-house building only ever gets the Route chip, no evolution requirements', () => {
    const model = formatServicesModel({
      buildingType: 'Farm-Wheat',
      roadAccess: { hasAccess: true, roadCount: 1 },
    });
    expect(model.items).toEqual([
      expect.objectContaining({ label: 'Route', status: 'ok' }),
    ]);
    expect(model.evolutionRequirements).toEqual([]);
  });

  test('a house shows Route, Marché and its own business access as informative chips — no service in this row anymore', () => {
    const model = formatServicesModel(houseVm());
    expect(model.items.map((i) => i.label)).toEqual(['Route', 'Marché', 'Entrepôt (activité)']);
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
});

// "Besoins pour l'évolution": every tier requirement, uniformly met/unmet, never a number — road excluded (Route is already
// the informative chip above, for every building type). The real count of a need (the water drunk, the energy used) lives
// on the Ressources tab (see houseInfoFormat.test.js); here it is a plain ✓/✗.
describe('servicesInfoFormat — evolution requirements', () => {
  const WATER_MET = { lastWaterConsumption: { month: 4, totalUnfed: 0 } };

  test('a tier-1 house (pop 1) shows population, food, water and a dispensary; food and water met, road excluded', () => {
    const model = formatServicesModel(
      houseVm({ buildingPop: 1, lastConsumption: { month: 4, totalUnfed: 0 }, outcomes: WATER_MET, periodKey: 4 }),
    );

    expect(model.evolutionRequirements.map((r) => r.label)).toEqual(['Population', 'Nourriture', 'Eau', 'Soins médicaux']);
    expect(model.evolutionRequirements.find((r) => r.label === 'Eau')).toEqual({
      emoji: '💧', label: 'Eau', value: '✓', status: 'ok', ariaLabel: 'Eau à portée',
    });
    expect(model.evolutionRequirements.find((r) => r.label === 'Nourriture')).toMatchObject({ status: 'ok', value: '✓' });
  });

  test('water unmet (nothing delivered) reads "inexistant", not a number', () => {
    const model = formatServicesModel(houseVm({ buildingPop: 1, periodKey: 4 }));

    expect(model.evolutionRequirements.find((r) => r.label === 'Eau')).toEqual({
      emoji: '💧', label: 'Eau', value: 'inexistant', status: 'off', ariaLabel: 'Eau non servi : inexistant',
    });
  });

  test('a cut-off house reads "insolvable" instead of "inexistant" for the unmet service', () => {
    const model = formatServicesModel(
      houseVm({
        buildingPop: 1,
        periodKey: 4,
        buildingRow: { serviceCutOff: { monthIndex: 4, categories: ['water'] } },
      }),
    );

    expect(model.evolutionRequirements.find((r) => r.label === 'Eau')).toMatchObject({ value: 'insolvable', status: 'off' });
  });

  test('population below the next tier\'s minimum reads unmet', () => {
    const model = formatServicesModel(houseVm({ buildingPop: 0, periodKey: 4 }));

    expect(model.evolutionRequirements.find((r) => r.label === 'Population')).toEqual({
      emoji: '👥', label: 'Population', value: null, status: 'off', ariaLabel: 'Population : besoin non couvert',
    });
  });

  test('a tier-2 house ALSO shows goods, fire cover, a warehouse and energy, each a plain checkmark — not a quantity', () => {
    const model = formatServicesModel(
      houseVm({
        houseLevel: 2,
        buildingPop: 4,
        lastConsumption: { month: 4, totalUnfed: 0 },
        outcomes: { ...WATER_MET, lastEnergyConsumption: { month: 4, totalUnfed: 0 } },
        activityAccess: true,
        periodKey: 4,
      }),
    );

    expect(model.evolutionRequirements.map((r) => r.label)).toEqual([
      'Population', 'Nourriture', 'Eau', 'Soins médicaux', 'Biens', 'Lutte contre le feu', 'Entrepôt (activité)', 'Énergie',
    ]);
    expect(model.evolutionRequirements.find((r) => r.label === 'Énergie')).toMatchObject({ status: 'ok', value: '✓' });
    expect(model.evolutionRequirements.find((r) => r.label === 'Entrepôt (activité)')).toEqual({
      emoji: '📦', label: 'Entrepôt (activité)', value: '✓', status: 'ok', ariaLabel: 'Entrepôt (activité) : besoin couvert',
    });
    expect(model.evolutionRequirements.find((r) => r.label === 'Lutte contre le feu')).toMatchObject({ status: 'off', value: 'inexistant' });
  });
});
