import { describe, test, expect } from '@jest/globals';
import { defineComponent } from '../../../src/engine/ecs/defineComponent.js';

describe('defineComponent', () => {
  test('crée un type de composant figé avec un nom', () => {
    const Position = defineComponent('Position');
    expect(Position.name).toBe('Position');
    expect(Object.isFrozen(Position)).toBe(true);
  });

  test('rejette un nom vide', () => {
    expect(() => defineComponent('')).toThrow();
    expect(() => defineComponent(null)).toThrow();
  });
});
