import { describe, test, expect } from '@jest/globals';
import { describePlacementNeeds } from '../../../src/presentation/dom/shell/BuildingNotifications.js';

// What the player is told when picking a building to place, read from that building's own catalog entry.
describe('describePlacementNeeds', () => {
  test('a building that needs another in reach says which, how far, and that it needs room', () => {
    expect(describePlacementNeeds('Market-Stall-Red')).toBe(
      'Étal rouge requiert : Moulin à moins de 5 cases (avec de la place libre).'
    );
  });

  test('a raw-material producer names the natural resource it draws on', () => {
    const message = describePlacementNeeds('Lumberjack');
    expect(message).toContain('Bûcheron requiert : ');
    expect(message).toMatch(/Sapin.*à moins de 6 cases/);
  });

  test('a workshop names where its supplies come from', () => {
    expect(describePlacementNeeds('Factory-Furniture')).toMatch(/Entrepôt à moins de 12 cases pour bois/);
  });

  test('a building that depends on nothing says nothing', () => {
    expect(describePlacementNeeds('Chapel')).toBeNull();
    expect(describePlacementNeeds('House-Blue')).toBeNull();
  });
});
