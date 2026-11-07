/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { renderHouseResidentsTab } from '../../../src/presentation/dom/info/views/houseResidentsInfoView.js';

// The Habitants tab of a house: small cards in a grid (the house first, then each citizen); pressing one opens its sheet, with the way back to the cards.
const ENVIRONMENT = { base: 40, level: 70, parts: [{ id: 'water', label: 'Eau', points: 30, max: 30 }] };

function model(residents) {
  return {
    buildingId: 'house-1',
    buildingType: 'House-Blue',
    accounting: { getHouseResidents: async () => residents },
    health: {
      average: 60,
      mentalAverage: 65,
      citizens: residents.length,
      sick: residents.filter((resident) => resident.health < 45 || resident.mentalHealth < 45).length,
      environment: ENVIRONMENT,
      mentalEnvironment: ENVIRONMENT,
      citizenEnvironments: Object.fromEntries(residents.map((resident) => [resident.id, ENVIRONMENT])),
      citizenMentalEnvironments: Object.fromEntries(residents.map((resident) => [resident.id, ENVIRONMENT])),
    },
  };
}

const RESIDENTS = [
  { id: 'c1', firstName: 'Jules', status: 'worker', workplaceType: 'Bank', health: 80, mentalHealth: 70, settled: true, amount: 12 },
  { id: 'c2', firstName: 'Léa', status: 'unemployed', workplaceType: null, health: 30, mentalHealth: 20, settled: false, amount: 0 },
];

describe('the Habitants tab', () => {
  test('one small card for the house, then one per citizen, each a button, with the sick one flagged', async () => {
    const container = document.createElement('div');

    await renderHouseResidentsTab(container, model(RESIDENTS));

    const cards = [...container.querySelectorAll('button.house-card')];
    expect(cards).toHaveLength(3);
    expect(cards[0].classList.contains('house-card--house')).toBe(true);
    expect(cards[1].textContent).toContain('Jules');
    expect(cards[2].textContent).toContain('Léa');
    expect(cards[1].classList.contains('is-sick')).toBe(false);
    expect(cards[2].classList.contains('is-sick')).toBe(true);
  });

  test('pressing a card opens its sheet in place of the cards, and the way back restores them', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    await renderHouseResidentsTab(container, model(RESIDENTS));

    container.querySelectorAll('button.house-card')[1].click();

    expect(container.querySelector('.house-residents-grid')).toBeNull();
    expect(container.querySelector('.house-resident-card__name').textContent).toBe('Jules');
    const back = container.querySelector('.house-sheet__back');
    expect(back).not.toBeNull();
    expect(document.activeElement).toBe(back);

    back.click();

    expect(container.querySelectorAll('button.house-card')).toHaveLength(3);
    expect(container.querySelector('.house-sheet__back')).toBeNull();
    container.remove();
  });

  test('the house card opens the sheet of the house: its inhabitants, their average health and the sick', async () => {
    const container = document.createElement('div');
    await renderHouseResidentsTab(container, model(RESIDENTS));

    container.querySelector('button.house-card--house').click();

    const facts = container.querySelector('.house-resident-card__facts').textContent;
    expect(facts).toContain('Habitants');
    expect(facts).toContain('Santé moyenne');
    expect(facts).toContain('Santé psychique moyenne');
    expect(facts).toContain('Malades');
    // The body's environment and the mind's, two histograms.
    expect(container.querySelectorAll('.health-histogram')).toHaveLength(2);
  });

  // The administrators stand outside health: their cards say so in place of the scores, and their sheets carry the reason, with no histogram.
  test('a house outside health: its cards say "Immortels", with no meter, and its sheets give the reason', async () => {
    const container = document.createElement('div');
    const administrators = { ...model(RESIDENTS), health: { outsideHealth: true } };
    administrators.accounting = { getHouseResidents: async () => RESIDENTS.map((resident) => ({ ...resident, status: 'administrator', health: 5, mentalHealth: 5 })) };
    await renderHouseResidentsTab(container, administrators);

    const cards = [...container.querySelectorAll('button.house-card')];
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.textContent.includes('Immortels'))).toBe(true);
    expect(container.querySelector('.house-card__meter')).toBeNull();
    expect(cards.some((card) => card.classList.contains('is-sick'))).toBe(false);

    cards[1].click();
    expect(container.querySelector('.house-resident-card__note').textContent).toContain('immortels');
    expect(container.querySelector('.health-histogram')).toBeNull();
    container.querySelector('.house-sheet__back').click();
    container.querySelector('button.house-card--house').click();
    expect(container.querySelector('.house-resident-card__note').textContent).toContain('immortels');
  });

  test('a citizen\'s card shows both scores, and his sheet both histograms', async () => {
    const container = document.createElement('div');
    await renderHouseResidentsTab(container, model(RESIDENTS));

    const card = container.querySelectorAll('button.house-card')[1];
    expect(card.textContent).toContain('Santé 80 · Psy 70');

    card.click();
    expect(container.querySelector('.house-resident-card__facts').textContent).toContain('Santé psychique');
    expect(container.querySelectorAll('.health-histogram')).toHaveLength(2);
  });
});
