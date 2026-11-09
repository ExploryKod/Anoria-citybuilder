/**
 * Which hub a distributor draws on first: the nearest, and among equally near ones the first in the catalog's order of orientations.
 */
import { describe, test, expect } from '@jest/globals';
import { DIRECTIONS, assertDirectionOrder, directionOf, rankHubsByPriority } from '../../../src/contexts/supply/domain/policies/HubPriorityPolicy.js';
import { BUILDING_ECONOMY } from '../../../src/shared/asset-economy/buildingEconomy.js';

describe('directionOf', () => {
  const from = { x: 10, y: 10 };
  test('names the eighth of the compass a hub lies in (north toward smaller y, east toward larger x)', () => {
    expect(directionOf(from, { x: 10, y: 7 })).toBe('north');
    expect(directionOf(from, { x: 13, y: 7 })).toBe('north-east');
    expect(directionOf(from, { x: 14, y: 10 })).toBe('east');
    expect(directionOf(from, { x: 13, y: 13 })).toBe('south-east');
    expect(directionOf(from, { x: 10, y: 14 })).toBe('south');
    expect(directionOf(from, { x: 7, y: 13 })).toBe('south-west');
    expect(directionOf(from, { x: 6, y: 10 })).toBe('west');
    expect(directionOf(from, { x: 7, y: 7 })).toBe('north-west');
  });
  test('a hub on the distributor\'s own tile has no orientation', () => {
    expect(() => directionOf(from, from)).toThrow(/no orientation/);
  });
});

describe('rankHubsByPriority', () => {
  const pos = { x: 10, y: 10 };
  const hub = (id, x, y) => ({ id, x, y });
  const order = ['south', 'east', 'north', 'west', 'south-east', 'south-west', 'north-east', 'north-west'];

  test('the nearest first, whatever the order of orientations', () => {
    expect(rankHubsByPriority(pos, [hub('far', 10, 15), hub('near', 12, 10)], order).map((h) => h.id)).toEqual(['near', 'far']);
  });

  test('equally near: the order of orientations decides', () => {
    const ranked = rankHubsByPriority(pos, [hub('north', 10, 8), hub('east', 12, 10), hub('south', 10, 12)], order);
    expect(ranked.map((h) => h.id)).toEqual(['south', 'east', 'north']);
  });

  test('a link without an order falls back on y, x and id', () => {
    expect(rankHubsByPriority(pos, [hub('b', 12, 10), hub('a', 10, 8)]).map((h) => h.id)).toEqual(['a', 'b']);
  });

  test('an order must name every orientation once', () => {
    expect(() => assertDirectionOrder(['north', 'south'])).toThrow(/exactly once/);
    expect(() => assertDirectionOrder([...DIRECTIONS.slice(1), 'north', 'north'])).toThrow(/exactly once/);
    expect(assertDirectionOrder(order)).toBe(order);
  });
});

describe('the market\'s links in the catalog', () => {
  test('declare an order of every orientation, the same on the placement and on the draw', () => {
    const market = BUILDING_ECONOMY['Market-Stall-Red'];
    const food = market.resourceRoles.find((role) => role.hubLink?.selection === 'nearest');
    expect(assertDirectionOrder(food.hubLink.directionOrder)).toBeTruthy();
    expect(market.placementRequires[0].directionOrder).toEqual(food.hubLink.directionOrder);
  });
});
