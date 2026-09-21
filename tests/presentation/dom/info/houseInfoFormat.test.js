/**
 * House Ressources tab — what the house ate last month, not a stock it no longer keeps.
 */
import { describe, test, expect } from '@jest/globals';
import { formatHouseResourcesModel } from '../../../../src/presentation/dom/info/presenters/formats/houseInfoFormat.js';

const cardOf = (model, kind) => model.cards.find((card) => card.kind === kind);

describe('formatHouseResourcesModel — consumed last month over what was needed', () => {
  test('says clearly that the figures are last month\'s consumption', () => {
    expect(formatHouseResourcesModel({ lastConsumption: null }).caption).toBe('Consommé le mois dernier :');
  });

  test('a fully fed house reads 8/8, met', () => {
    const model = formatHouseResourcesModel({
      lastConsumption: { demand: 8, taken: 8, totalUnfed: 0, takenByCategory: { wheat: 5, fruit: 3 } },
    });
    const total = cardOf(model, 'food');
    expect(total.valueText).toBe('8/8');
    expect(total.met).toBe(true);
  });

  test('a house that could not eat enough reads 4/8, not met', () => {
    const model = formatHouseResourcesModel({
      lastConsumption: { demand: 8, taken: 4, totalUnfed: 4, takenByCategory: { wheat: 4 } },
    });
    const total = cardOf(model, 'food');
    expect(total.valueText).toBe('4/8');
    expect(total.met).toBe(false);
    expect(total.ariaLabel).toContain('4 sur 8');
  });

  test('each good shows how much of it was eaten', () => {
    const model = formatHouseResourcesModel({
      lastConsumption: { demand: 8, taken: 8, totalUnfed: 0, takenByCategory: { wheat: 5, fruit: 3 } },
    });
    expect(cardOf(model, 'wheat').valueText).toBe('5');
    expect(cardOf(model, 'fruit').valueText).toBe('3');
    expect(cardOf(model, 'carrot').valueText).toBe('0');
  });

  test('a stock left in the house is no longer what is shown', () => {
    const model = formatHouseResourcesModel({
      stocks: { wheat: 9, food: 9 },
      lastConsumption: { demand: 8, taken: 4, totalUnfed: 4, takenByCategory: { wheat: 4 } },
    });
    expect(cardOf(model, 'wheat').valueText).toBe('4');
    expect(cardOf(model, 'food').valueText).toBe('4/8');
  });

  test('before any meal, nothing is claimed', () => {
    const model = formatHouseResourcesModel({ lastConsumption: null });
    expect(cardOf(model, 'food').valueText).toBe('–');
    expect(cardOf(model, 'food').met).toBe(false);
  });
});
