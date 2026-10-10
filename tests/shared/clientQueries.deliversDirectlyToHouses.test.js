import { describe, test, expect } from '@jest/globals';
import { deliversDirectlyToHouses } from '../../src/shared/building-catalog/clientQueries.js';

// Regression: the Clients-tab bug this pins — a producer whose output never reaches a hub (Chapel's
// faith, since 2026-10-10) used to be indistinguishable from an ordinary producer with simply no client
// nearby right now, so the UI showed "this good goes to a warehouse" for a good that never does.
describe('deliversDirectlyToHouses — a producer whose output never reaches a hub', () => {
  test('Chapel\'s faith is declared deliversTo: house', () => {
    expect(deliversDirectlyToHouses('Chapel', 'faith')).toBe(true);
  });

  test('an ordinary producer (wood, sent to a hub) is not', () => {
    expect(deliversDirectlyToHouses('Lumberjack', 'wood')).toBe(false);
  });

  test('a category the type does not even produce is not', () => {
    expect(deliversDirectlyToHouses('Chapel', 'wood')).toBe(false);
  });

  test('a type with no producer role at all is not', () => {
    expect(deliversDirectlyToHouses('Market-Stall', 'wheat')).toBe(false);
  });
});
