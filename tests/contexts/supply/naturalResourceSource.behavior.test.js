/**
 * Behavior tests — Supply: a raw-material producer draws on a natural resource in range.
 * Real catalog (Lumberjack + trees), no fake: what is under test is the catalog's `source` fact
 * — production, using the tree up, the "no resource" warning, and the placement gate.
 */

import { describe, test, expect } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { ProduceResource } from '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js';
import { canPlaceBuildingAt } from '../../../src/contexts/supply/domain/policies/PlacementRequirementPolicy.js';
import { getNaturalSources } from '../../../src/shared/building-catalog/resourceRoleQueries.js';

const PERIOD = { season: 'spring', year: 1, monthIndex: 3 };
const RANGE = getNaturalSources('Lumberjack')[0].range;

function setup({ trees }) {
  const rows = new Map([
    ['lj', { id: 'lj', type: 'Lumberjack', x: 10, y: 10, roadCount: 1, worker: 2, workerNeed: 2, stocks: {} }],
  ]);
  const naturals = new Map(trees.map((t) => [t.id, { type: 'Tree-Sapin', ...t }]));
  const repository = {
    async findById(id) {
      const b = rows.get(id);
      return b && createSupplyBuildingSnapshot({ ...b, stocks: createSupplyStock(b.stocks) });
    },
    async saveStocks(id, stocks) {
      rows.get(id).stocks = { ...createSupplyStock(stocks) };
    },
    async updateBuildingFields(id, fields) {
      Object.assign(rows.get(id), fields);
    },
    async listNaturalResources() {
      return [...naturals.values()];
    },
  };
  const produce = new ProduceResource(repository, {
    removeBuilding: async ({ instanceId }) => naturals.delete(instanceId),
  });
  return { rows, naturals, produce };
}

describe('Supply — raw-material producer and its natural resource', () => {
  test('produces wood, fells the nearest tree, and idles once none is left', async () => {
    const { rows, naturals, produce } = setup({
      trees: [
        { id: 'near', x: 11, y: 10 },
        { id: 'far', x: 10 + RANGE, y: 10 },
      ],
    });

    const first = await produce.execute({ buildingId: 'lj', period: PERIOD });
    expect(first.produced).toBe(true);
    expect(rows.get('lj').stocks.wood).toBeGreaterThan(0);
    expect([...naturals.keys()]).toEqual(['far']);

    // Next month the last tree goes; the month after, there is nothing left to work with.
    await produce.execute({ buildingId: 'lj', period: { ...PERIOD, monthIndex: 4 } });
    expect(naturals.size).toBe(0);
    const idle = await produce.execute({ buildingId: 'lj', period: { ...PERIOD, monthIndex: 5 } });
    expect(idle).toEqual({ produced: false, reason: 'no_resource' });
  });

  test('a tree beyond the catalog range is not a source: no production', async () => {
    const { naturals, produce } = setup({ trees: [{ id: 'out', x: 10 + RANGE + 1, y: 10 }] });

    const result = await produce.execute({ buildingId: 'lj', period: PERIOD });

    expect(result).toEqual({ produced: false, reason: 'no_resource' });
    expect(naturals.size).toBe(1);
  });

  test('the ghost cannot be placed beyond the range, and can within it', () => {
    const inRange = [{ id: 't', type: 'Tree-Sapin', x: 10, y: 10 + RANGE }];
    const outOfRange = [{ id: 't', type: 'Tree-Sapin', x: 10, y: 10 + RANGE + 1 }];
    const check = (naturalCandidates) =>
      canPlaceBuildingAt({ x: 10, y: 10, buildingType: 'Lumberjack', candidates: [], naturalCandidates });

    expect(check(inRange).ok).toBe(true);
    expect(check(outOfRange)).toEqual({ ok: false, reason: 'natural_resource_missing' });
    expect(check([])).toEqual({ ok: false, reason: 'natural_resource_missing' });
  });
});
