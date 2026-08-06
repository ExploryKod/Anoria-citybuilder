import { describe, test, expect, beforeEach } from '@jest/globals';
import { TransferFactoryToBarn } from '../../../../src/contexts/supply/application/commands/commerce/TransferFactoryToBarn.js';
import { BarnStockOperations } from '../../../../src/contexts/supply/application/services/BarnStockOperations.js';
import { SUPPLY_FLOW } from '../../../../src/contexts/supply/domain/manufacturing/SupplyFlow.js';
import { createBuildingInstanceId } from '../../../fixtures/buildingRecord.js';

class InMemorySupplyRepo {
  constructor(rows = []) {
    this.rows = new Map(rows.map((row) => [row.id, { ...row }]));
  }

  async findCommerceBarnRows() {
    return [...this.rows.values()].filter((row) => (row.type || '').includes('Barn'));
  }

  async findRowById(id) {
    return this.rows.get(id) ?? null;
  }

  async saveCommerceStocks(id, commerceStocks) {
    const row = this.rows.get(id);
    if (!row) return;
    row.commerceStocks = commerceStocks;
  }
}

class InMemoryFactoryRepo {
  constructor(factories = []) {
    this.factories = new Map(factories.map((f) => [f.id, { ...f }]));
  }

  async findFactories() {
    return [...this.factories.values()];
  }

  async updateFields(factoryId, fields) {
    const factory = this.factories.get(factoryId);
    if (!factory) return;
    Object.assign(factory, fields);
  }

  instanceId(row) {
    return row.id;
  }
}

describe('TransferFactoryToBarn', () => {
  let barnId;
  let factoryId;
  let supplyRepo;
  let factoryRepo;
  let command;

  beforeEach(() => {
    barnId = createBuildingInstanceId();
    factoryId = createBuildingInstanceId();

    supplyRepo = new InMemorySupplyRepo([
      {
        id: barnId,
        type: 'Barn-001',
        roads: 1,
        isActive: true,
        employees: { worker: 2, worker_need: 1 },
        commerceStocks: { wood: 0, furniture: 0, figs: 0 },
        hubStorageOrders: {
          wood: { mode: 'accept', maxPercent: 100 },
          furniture: { mode: 'accept', maxPercent: 100 },
          figs: { mode: 'accept', maxPercent: 100 },
        },
      },
    ]);

    factoryRepo = new InMemoryFactoryRepo([
      {
        id: factoryId,
        type: 'Winery-001',
        supplyFlow: SUPPLY_FLOW.COMMERCE,
        roads: 1,
        isActive: true,
        rawMaterials: { wood: 12 },
        products: { furniture: 2 },
      },
    ]);

    command = new TransferFactoryToBarn(
      factoryRepo,
      supplyRepo,
      new BarnStockOperations(supplyRepo)
    );
  });

  test('moves wood and furniture from commerce factory to barn', async () => {
    const outcome = await command.execute({ time: 0 });

    expect(outcome.transferred).toHaveLength(2);
    expect(outcome.transferred.find((t) => t.productId === 'wood')?.quantity).toBe(12);
    expect(outcome.transferred.find((t) => t.productId === 'furniture')?.quantity).toBe(2);

    const barn = await supplyRepo.findRowById(barnId);
    expect(barn.commerceStocks.wood).toBe(12);
    expect(barn.commerceStocks.furniture).toBe(2);

    const factory = factoryRepo.factories.get(factoryId);
    expect(factory.rawMaterials.wood).toBe(0);
    expect(factory.products.furniture).toBe(0);
  });

  test('skips city factories', async () => {
    factoryRepo.factories.set(factoryId, {
      id: factoryId,
      type: 'Winery-001',
      supplyFlow: SUPPLY_FLOW.CITY,
      roads: 1,
      isActive: true,
      rawMaterials: { wood: 5 },
      products: {},
    });

    const outcome = await command.execute({ time: 0 });
    expect(outcome.transferred).toHaveLength(0);
    expect((await supplyRepo.findRowById(barnId)).commerceStocks.wood).toBe(0);
  });

  test('respects line max cap on direct transfer', async () => {
    factoryRepo.factories.set(factoryId, {
      id: factoryId,
      type: 'Winery-001',
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      roads: 1,
      isActive: true,
      productWorkerDistribution: { wood: 2, furniture: 2 },
      rawMaterials: { wood: 12 },
      products: { furniture: 2 },
      lineMaxCaps: {
        'wood:direct': 5,
        'furniture:direct': 1,
      },
    });

    const outcome = await command.execute({ time: 0 });

    expect(outcome.transferred.find((t) => t.productId === 'wood')?.quantity).toBe(5);
    expect(outcome.transferred.find((t) => t.productId === 'furniture')?.quantity).toBe(1);
  });

  test('respects worker-based barn capacity', async () => {
    const row = supplyRepo.rows.get(barnId);
    row.employees = { worker: 1 };
    factoryRepo.factories.set(factoryId, {
      id: factoryId,
      type: 'Winery-001',
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      roads: 1,
      isActive: true,
      rawMaterials: { wood: 12 },
      products: { furniture: 2 },
    });

    const outcome = await command.execute({ time: 0 });

    expect(outcome.transferred.find((t) => t.productId === 'wood')?.quantity).toBe(10);
    expect(outcome.transferred.find((t) => t.productId === 'furniture')?.quantity).toBeUndefined();

    const barn = await supplyRepo.findRowById(barnId);
    expect(barn.commerceStocks.wood).toBe(10);
    expect(barn.commerceStocks.furniture).toBe(0);
  });

  test('returns no_operational_barn when barn missing', async () => {
    supplyRepo.rows.clear();
    const outcome = await command.execute({ time: 0 });
    expect(outcome.reason).toBe('no_operational_barn');
  });
});
