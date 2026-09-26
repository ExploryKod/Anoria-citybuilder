/**
 * House Ressources tab — the house's needs (what it used up over what it needed), with the goods of each
 * need one click away.
 */
import { describe, test, expect } from '@jest/globals';
import { formatHouseResourcesModel } from '../../../../src/presentation/dom/info/presenters/formats/houseInfoFormat.js';

const needOf = (model, kind) => model.needs.find((need) => need.kind === kind);
const goodOf = (model, needKind, kind) => needOf(model, needKind).details.find((card) => card.kind === kind);

describe('formatHouseResourcesModel — needs first, goods in detail', () => {
  test('says clearly that the figures are last month\'s consumption', () => {
    expect(formatHouseResourcesModel({ lastConsumption: null }).caption).toBe('Consommé le mois dernier :');
  });

  test('a house has one card per need the catalog gives it, the diet first', () => {
    const model = formatHouseResourcesModel({ buildingType: 'House-Red', lastConsumption: null });
    expect(model.needs.map((need) => need.kind)).toEqual(['food', 'goods']);
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
});
