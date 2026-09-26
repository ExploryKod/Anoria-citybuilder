/**
 * Behavior tests — Supply: a producer whose sale window closes with goods unsold says so, and why.
 * Real catalog (Factory-Pot sells in odd months, the Warehouse collects).
 */

import { describe, test, expect } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { MarkFailedSales } from '../../../src/contexts/supply/application/commands/surplus/MarkFailedSales.js';

class InMemoryRepository {
  constructor(rows) {
    this.rows = new Map(rows.map((row) => [row.id, { roadCount: 1, worker: 1, workerNeed: 1, ...row }]));
  }

  async findByResourceRole(role, categories) {
    return [...this.rows.values()]
      .filter((row) => hasResourceRole(row.type, role, categories))
      .map((row) => createSupplyBuildingSnapshot({ ...row, stocks: createSupplyStock(row.stocks) }));
  }

  async updateBuildingFields(id, fields) {
    Object.assign(this.rows.get(id), fields);
  }
}

const month = (monthIndex) => ({ monthIndex, year: 1, dayInMonth: 1, month: 'x', season: 'spring' });

describe('Supply — failed sales', () => {
  test('goods left when the sale window closes are reported, with the cause', async () => {
    const repo = new InMemoryRepository([{ id: 'pots', type: 'Factory-Pot', x: 0, y: 0, stocks: { pot: 10 } }]);
    const command = new MarkFailedSales(repo);

    await command.execute({ period: month(1) }); // window open: watched
    expect(repo.rows.get('pots').lastFailedSale).toBeUndefined();

    await command.execute({ period: month(2) }); // window closed, nothing took the pots
    expect(repo.rows.get('pots').lastFailedSale).toEqual({ year: 1, monthIndex: 2, units: 10, cause: 'no_hub' });
  });

  test('a hub with no room is the cause when there is one in reach', async () => {
    const repo = new InMemoryRepository([
      { id: 'pots', type: 'Factory-Pot', x: 0, y: 0, stocks: { pot: 10 } },
      { id: 'wh', type: 'Warehouse', x: 3, y: 0, maxStock: 500, stocks: { goods: 500, pot: 500 } },
    ]);
    const command = new MarkFailedSales(repo);
    await command.execute({ period: month(1) });
    await command.execute({ period: month(2) });
    expect(repo.rows.get('pots').lastFailedSale.cause).toBe('hub_full');
  });

  test('a producer that sold everything reports nothing, and is not reported twice', async () => {
    const repo = new InMemoryRepository([{ id: 'pots', type: 'Factory-Pot', x: 0, y: 0, stocks: { pot: 0 } }]);
    const command = new MarkFailedSales(repo);
    await command.execute({ period: month(1) });
    await command.execute({ period: month(2) });
    expect(repo.rows.get('pots').lastFailedSale).toBeUndefined();

    repo.rows.get('pots').stocks = { pot: 4 };
    await command.execute({ period: month(4) }); // still closed and no longer watched: silent
    expect(repo.rows.get('pots').lastFailedSale).toBeUndefined();
  });
});
