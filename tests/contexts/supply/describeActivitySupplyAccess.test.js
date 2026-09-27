/**
 * DescribeActivitySupplyAccess — the STRUCTURAL reason a recipe cannot even reach one of its inputs (no hub
 * in range at all, or a hub in range that nothing ever supplies), as opposed to `activityShortfall`'s "not
 * there just now". Real catalog (House-Red, Factory-Oil); a small in-memory repository standing in for Dexie.
 */
import { describe, test, expect } from '@jest/globals';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { DescribeActivitySupplyAccess } from '../../../src/contexts/supply/application/queries/DescribeActivitySupplyAccess.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';

class InMemoryRepository {
  constructor(buildings) {
    this.raw = new Map(buildings.map((b) => [b.id, { roadCount: 1, worker: 2, workerNeed: 2, ...b }]));
  }
  async findByResourceRole(role, categories) {
    return [...this.raw.values()].filter((b) => hasResourceRole(b.type, role, categories));
  }
}

const ids = (...names) => Object.fromEntries(names.map((name) => [name, createBuildingInstanceId()]));

describe('DescribeActivitySupplyAccess', () => {
  test('no warehouse anywhere: the gap names the missing hub, not a temporary shortage', async () => {
    const id = ids('house');
    const repo = new InMemoryRepository([{ id: id.house, type: 'House-Red', x: 0, y: 0 }]);
    const gaps = await new DescribeActivitySupplyAccess(repo).execute({ id: id.house, type: 'House-Red', x: 0, y: 0 });
    expect(gaps).toContainEqual({ category: 'decoratedPot', inputCategory: 'pot', role: 'hub', status: 'no-hub' });
  });

  test('a warehouse is reachable, but nobody in the city makes plain pots: no-supplier, not no-hub', async () => {
    const id = ids('house', 'wh');
    const repo = new InMemoryRepository([
      { id: id.house, type: 'House-Red', x: 0, y: 0 },
      { id: id.wh, type: 'Warehouse', x: 3, y: 0 },
    ]);
    const gaps = await new DescribeActivitySupplyAccess(repo).execute({ id: id.house, type: 'House-Red', x: 0, y: 0 });
    expect(gaps).toContainEqual({ category: 'decoratedPot', inputCategory: 'pot', role: 'hub', status: 'no-supplier' });
  });

  test('a warehouse is reachable and an operational pottery workshop exists: no gap at all for pots', async () => {
    const id = ids('house', 'wh', 'pottery');
    const repo = new InMemoryRepository([
      { id: id.house, type: 'House-Red', x: 0, y: 0 },
      { id: id.wh, type: 'Warehouse', x: 3, y: 0 },
      { id: id.pottery, type: 'Factory-Pot', x: 5, y: 0 },
    ]);
    const gaps = await new DescribeActivitySupplyAccess(repo).execute({ id: id.house, type: 'House-Red', x: 0, y: 0 });
    expect(gaps.some((gap) => gap.inputCategory === 'pot')).toBe(false);
  });

  test('an unstaffed warehouse does not count as reachable', async () => {
    const id = ids('house', 'wh');
    const repo = new InMemoryRepository([
      { id: id.house, type: 'House-Red', x: 0, y: 0 },
      { id: id.wh, type: 'Warehouse', x: 3, y: 0, worker: 0 },
    ]);
    const gaps = await new DescribeActivitySupplyAccess(repo).execute({ id: id.house, type: 'House-Red', x: 0, y: 0 });
    expect(gaps).toContainEqual({ category: 'decoratedPot', inputCategory: 'pot', role: 'hub', status: 'no-hub' });
  });

  test('a building without a recipe (a plain source) has no gap to report', async () => {
    const repo = new InMemoryRepository([]);
    const gaps = await new DescribeActivitySupplyAccess(repo).execute({ id: 'x', type: 'Lumberjack', x: 0, y: 0 });
    expect(gaps).toEqual([]);
  });
});
