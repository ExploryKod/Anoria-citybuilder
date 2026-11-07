/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { renderHealthHistogram } from '../../../src/presentation/dom/info/views/healthHistogramView.js';

// The bar is the scale of health, 0 to 100: a level reads as how far it fills, whatever the parts that make it. Regression: it was drawn to the width of what the house
// gives, so a base alone (the mind of a house with no culture) filled it whole, in a flat grey, whatever its level.
const widthOf = (node) => Number.parseFloat(node.style.flexBasis);

describe('the health histogram', () => {
  test('a base alone fills the bar as far as its level, not the whole width', () => {
    const section = renderHealthHistogram({ base: 60, level: 60, parts: [{ id: 'culture', label: 'Bibliothèque', points: 0, max: 5 }] }, 0, 'Niveau');

    const segments = section.querySelectorAll('.health-histogram__bar > .health-histogram__segment');
    expect(segments).toHaveLength(1);
    expect(widthOf(segments[0])).toBe(60);
  });

  test('what the parts that give add stacks after the base; what each of the others takes off is drawn over the end in its own colour, and the level is what stays plain', () => {
    const environment = {
      base: 60,
      level: 60 + 10 - 15 - 5,
      parts: [
        { id: 'culture', label: 'Théâtre', points: 10, max: 10 },
        { id: 'unemployment', label: 'Chômage', points: -15, max: 0 },
        { id: 'hunger', label: 'Faim', points: -5, max: 0 },
      ],
    };

    const section = renderHealthHistogram(environment, 0, 'Niveau');

    const [base, culture, unemployment, hunger] = section.querySelectorAll('.health-histogram__bar > .health-histogram__segment');
    expect([widthOf(base), widthOf(culture)]).toEqual([60, 10]);
    // The level is 50: the first removal begins there and the second follows it, so together they end where what was given ended (70).
    expect([unemployment.style.left, unemployment.style.width]).toEqual(['50%', '15%']);
    expect([hunger.style.left, hunger.style.width]).toEqual(['65%', '5%']);
    expect(unemployment.classList.contains('health-histogram__lost') && hunger.classList.contains('health-histogram__lost')).toBe(true);
    // Each keeps the colour of its factor (its place in the list), and the row's swatch has the same, hatched.
    expect(unemployment.className).toContain('health-histogram__segment--2');
    expect(hunger.className).toContain('health-histogram__segment--3');
    const swatches = [...section.querySelectorAll('.health-histogram__swatch')];
    expect(swatches[2].className).toContain('health-histogram__segment--2');
    expect(swatches[2].classList.contains('health-histogram__swatch--taken')).toBe(true);
    expect(swatches[1].classList.contains('health-histogram__swatch--taken')).toBe(false);
    const values = [...section.querySelectorAll('.health-histogram__value')].map((node) => node.textContent);
    expect(values).toEqual(['60', '+10', '-15', '-5']);
  });

  // The pointer over a part of the bar says which factor it is and its points; over the track, the level.
  test('each part of the bar has a tooltip with its factor and its points, and the bar itself the level', () => {
    const environment = {
      base: 60,
      level: 60 + 10 - 15,
      parts: [
        { id: 'culture', label: 'Théâtre', points: 10, max: 10 },
        { id: 'unemployment', label: 'Chômage', points: -15, max: 0 },
      ],
    };

    const section = renderHealthHistogram(environment, 0, 'Niveau');

    const bar = section.querySelector('.health-histogram__bar');
    expect([...bar.querySelectorAll('.health-histogram__segment')].map((part) => part.title)).toEqual(['Base : 60', 'Théâtre : +10', 'Chômage : -15']);
    expect(bar.title).toBe('Niveau : 55 sur 100');
  });

  test('a histogram says whose environment it draws', () => {
    expect(() => renderHealthHistogram({ base: 40, level: 40, parts: [] }, 0)).toThrow(/whose environment/);
  });
});
