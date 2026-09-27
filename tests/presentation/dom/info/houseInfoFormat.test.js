/**
 * House Ressources tab — the house's needs (what it used up over what it needed), with the goods of each
 * need one click away.
 */
import { describe, test, expect } from '@jest/globals';
import { getQuantityConsumerEntries } from '../../../../src/shared/building-catalog/resourceRoleQueries.js';
import { formatHouseResourcesModel, formatHouseActivityModel } from '../../../../src/presentation/dom/info/presenters/formats/houseInfoFormat.js';

const needOf = (model, kind) => model.needs.find((need) => need.kind === kind);
const goodOf = (model, needKind, kind) => needOf(model, needKind).details.find((card) => card.kind === kind);

describe('formatHouseResourcesModel — needs first, goods in detail', () => {
  test('says clearly that the figures are last month\'s consumption', () => {
    expect(formatHouseResourcesModel({ lastConsumption: null }).caption).toBe('Consommé le mois dernier :');
  });

  test('a house has one card per need the catalog gives it, the diet first', () => {
    const model = formatHouseResourcesModel({ buildingType: 'House-Red', lastConsumption: null });
    expect(model.needs.map((need) => need.kind)).toEqual(getQuantityConsumerEntries('House-Red').map((entry) => entry.totalKey));
    expect(model.needs[0].kind).toBe('food');
  });

  test('a fully fed house reads 8/8, met', () => {
    const model = formatHouseResourcesModel({
      lastConsumption: { demand: 8, taken: 8, totalUnfed: 0, takenByCategory: { wheat: 5, fruit: 3 } },
    });
    const card = needOf(model, 'food').card;
    expect(card.valueText).toBe('8/8');
    expect(card.met).toBe(true);
  });

  test('a house that could not eat enough reads 4/8, not met', () => {
    const model = formatHouseResourcesModel({
      lastConsumption: { demand: 8, taken: 4, totalUnfed: 4, takenByCategory: { wheat: 4 } },
    });
    const card = needOf(model, 'food').card;
    expect(card.valueText).toBe('4/8');
    expect(card.met).toBe(false);
    expect(card.ariaLabel).toContain('4 sur 8');
  });

  test('the detail of a need says how much of each of its goods was used', () => {
    const model = formatHouseResourcesModel({
      lastConsumption: { demand: 8, taken: 8, totalUnfed: 0, takenByCategory: { wheat: 5, fruit: 3 } },
    });
    expect(goodOf(model, 'food', 'wheat').valueText).toBe('5');
    expect(goodOf(model, 'food', 'fruit').valueText).toBe('3');
    expect(goodOf(model, 'food', 'carrot').valueText).toBe('0');
  });

  test('each need reads its own record: goods used up never show as food', () => {
    const model = formatHouseResourcesModel({
      buildingType: 'House-Red',
      lastConsumption: { demand: 12, taken: 12, totalUnfed: 0, takenByCategory: { wheat: 12 } },
      buildingRow: { lastGoodsConsumption: { demand: 3, taken: 2, totalUnfed: 1, takenByCategory: { pot: 2 } } },
    });
    expect(needOf(model, 'food').card.valueText).toBe('12/12');
    expect(needOf(model, 'goods').card.valueText).toBe('2/3');
    expect(goodOf(model, 'goods', 'pot').valueText).toBe('2');
    expect(needOf(model, 'food').details.some((card) => card.kind === 'pot')).toBe(false);
  });

  test('a stock left in the house is no longer what is shown', () => {
    const model = formatHouseResourcesModel({
      stocks: { wheat: 9, food: 9 },
      lastConsumption: { demand: 8, taken: 4, totalUnfed: 4, takenByCategory: { wheat: 4 } },
    });
    expect(goodOf(model, 'food', 'wheat').valueText).toBe('4');
    expect(needOf(model, 'food').card.valueText).toBe('4/8');
  });

  test('before any meal, nothing is claimed', () => {
    const model = formatHouseResourcesModel({ lastConsumption: null });
    expect(needOf(model, 'food').card.valueText).toBe('–');
    expect(needOf(model, 'food').card.met).toBe(false);
  });

  test('each need says how it is worked out: inhabitants × its rate and unit, in the player\'s number format', () => {
    const model = formatHouseResourcesModel({
      buildingType: 'House-Red',
      buildingPop: 12,
      lastConsumption: { demand: 12, taken: 12, totalUnfed: 0, takenByCategory: { wheat: 12 } },
      buildingRow: { lastGoodsConsumption: { demand: 3, taken: 3, totalUnfed: 0, takenByCategory: { pot: 3 } } },
    });
    expect(needOf(model, 'food').card.detailText).toBe('Besoin : 12 hab. × 1 panier');
    expect(needOf(model, 'goods').card.detailText).toBe('Besoin : 12 hab. × 0,25 bien');
  });

  test('before any record, the calculation uses the population now', () => {
    const model = formatHouseResourcesModel({ buildingType: 'House-Red', buildingPop: 8, lastConsumption: null });
    expect(needOf(model, 'goods').card.detailText).toBe('Besoin : 8 hab. × 0,25 bien');
  });
});

describe('formatHouseActivityModel — a house\'s own business, one block per recipe', () => {
  test('a house without a business gets an empty list, not a thrown error', () => {
    expect(formatHouseActivityModel({}).recipes).toEqual([]);
  });

  test('House-Red has one block per recipe its catalog declares, in order', () => {
    const model = formatHouseActivityModel({ buildingType: 'House-Red', buildingRow: null });
    expect(model.recipes.map((r) => r.category)).toEqual(['decoratedPot', 'carrotCake']);
  });

  test('before any cycle ran, the raw material reads "not yet", not zero', () => {
    const model = formatHouseActivityModel({ buildingType: 'House-Red', buildingRow: null });
    const pot = model.recipes[0];
    expect(pot.materials).toHaveLength(1);
    expect(pot.materials[0].kind).toBe('pot');
    expect(pot.materials[0].valueText).toBe('–');
    expect(pot.materials[0].met).toBe(false);
    expect(pot.product.valueText).toBe('0');
  });

  test('after a cycle took its inputs, the material reads consommé/besoin like a personal need', () => {
    const buildingRow = {
      activityInputs: { decoratedPot: { year: 1, monthIndex: 1, takenByCategory: { pot: 10 } } },
      stocks: { decoratedPot: 10 },
    };
    const model = formatHouseActivityModel({ buildingType: 'House-Red', buildingRow });
    const pot = model.recipes[0];
    expect(pot.materials[0].valueText).toBe('10/10');
    expect(pot.materials[0].met).toBe(true);
    expect(pot.product.valueText).toBe('10');
    expect(pot.product.met).toBe(true);
  });

  test('the cake needs three goods at once: each gets its own card', () => {
    const model = formatHouseActivityModel({ buildingType: 'House-Red', buildingRow: null });
    const cake = model.recipes[1];
    expect(cake.materials.map((m) => m.kind)).toEqual(['wheat', 'carrot', 'oil']);
  });

  test('a two-step recipe gets two step cards, numbered', () => {
    const model = formatHouseActivityModel({ buildingType: 'House-Red', buildingRow: null });
    const pot = model.recipes[0];
    expect(pot.steps.map((s) => s.label)).toEqual(['Étape 1', 'Étape 2']);
  });

  test('a step already done this cycle reads done, the one after it in progress', () => {
    const buildingRow = { cycleState: { decoratedPot: { index: 1, value: 2, opened: false } } };
    const model = formatHouseActivityModel({ buildingType: 'House-Red', buildingRow });
    const pot = model.recipes[0];
    expect(pot.steps[0].valueText).toBe('Terminée');
    expect(pot.steps[0].met).toBe(true);
    expect(pot.steps[1].valueText).toBe('En cours');
    expect(pot.steps[1].met).toBe(false);
  });

  test('a step stuck on a missing input is called out, not just "in progress"', () => {
    const buildingRow = {
      activityShortfall: { carrotCake: true },
      cycleState: { carrotCake: { index: 0, value: 0, opened: true } },
    };
    const model = formatHouseActivityModel({ buildingType: 'House-Red', buildingRow });
    const cake = model.recipes[1];
    expect(cake.steps[0].valueText).toBe('En attente de matière');
    expect(cake.steps[0].met).toBe(false);
    expect(cake.steps[1].valueText).toBe('À venir');
  });
});
