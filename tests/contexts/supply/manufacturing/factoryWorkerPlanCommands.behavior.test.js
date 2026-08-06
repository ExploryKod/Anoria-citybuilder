import { describe, test, expect, beforeEach } from '@jest/globals';
import { UpdateFactoryWorkerDemandFromCaps } from '../../../../src/contexts/supply/application/commands/manufacturing/UpdateFactoryWorkerDemandFromCaps.js';
import { AllocateFactoryWorkersToCommodityLines } from '../../../../src/contexts/supply/application/commands/manufacturing/AllocateFactoryWorkersToCommodityLines.js';
import { GetFactoryWorkerPlanView } from '../../../../src/contexts/supply/application/queries/GetFactoryWorkerPlanView.js';
import { SUPPLY_FLOW } from '../../../../src/contexts/supply/domain/manufacturing/SupplyFlow.js';
import { factoryLineDestinationKey } from '../../../../src/contexts/supply/domain/manufacturing/FactoryLineAllocationPolicy.js';
import { computeCityEmploymentSummary } from '../../../../src/contexts/employment/domain/computeCityEmploymentSummary.js';
import { createEmploymentBuildingSnapshot } from '../../../../src/contexts/employment/domain/EmploymentBuildingSnapshot.js';
import { createBuildingInstanceId } from '../../../fixtures/buildingRecord.js';

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

describe('Factory worker plan commands', () => {
  let factoryId;
  let repo;

  beforeEach(() => {
    factoryId = createBuildingInstanceId();
    repo = new InMemoryFactoryRepo([
      {
        id: factoryId,
        type: 'Winery-001',
        supplyFlow: SUPPLY_FLOW.COMMERCE,
        roads: 1,
        sector: 3,
        employees: { worker: 0, worker_need: 18, elite: 0, elite_need: 0 },
        lineMaxCaps: {
          [factoryLineDestinationKey('wood', 'direct')]: 200,
          [factoryLineDestinationKey('furniture', 'direct')]: 0,
        },
      },
    ]);
  });

  test('UpdateFactoryWorkerDemandFromCaps publishes worker_need from caps', async () => {
    const command = new UpdateFactoryWorkerDemandFromCaps(repo);
    const result = await command.execute();

    expect(result.updated).toBe(1);
    const factory = (await repo.findFactories())[0];
    expect(factory.employees.worker_need).toBe(2);
  });

  test('AllocateFactoryWorkersToCommodityLines splits assigned workers by line demand', async () => {
    const factory = (await repo.findFactories())[0];
    factory.employees = { worker: 2, worker_need: 2 };

    const command = new AllocateFactoryWorkersToCommodityLines(repo);
    await command.execute();

    const updated = (await repo.findFactories())[0];
    expect(updated.productWorkerDistribution).toEqual({ wood: 2 });
    expect(updated.productProductionPercentages).toEqual({ wood: 100 });
  });

  test('GetFactoryWorkerPlanView exposes preview without touching persistence', () => {
    const query = new GetFactoryWorkerPlanView();
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      employees: { worker: 1 },
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 200,
        [factoryLineDestinationKey('furniture', 'direct')]: 200,
      },
    };

    const plan = query.execute({
      factory,
      lineMaxCaps: {
        [factoryLineDestinationKey('furniture', 'direct')]: 0,
      },
    });

    expect(plan.totalWorkerNeed).toBe(2);
    expect(plan.lines.find((line) => line.commodityId === 'furniture')?.workerDemand).toBe(0);
    expect(plan.lines.find((line) => line.commodityId === 'wood')?.workerDemand).toBe(2);
  });

  test('dynamic worker_need flows into employment lack calculation', async () => {
    await new UpdateFactoryWorkerDemandFromCaps(repo).execute();
    const factory = (await repo.findFactories())[0];
    factory.employees.worker = 0;

    const summary = computeCityEmploymentSummary([
      createEmploymentBuildingSnapshot({
        id: factoryId,
        type: 'Winery-001',
        roadCount: 1,
        sector: 3,
        worker: factory.employees.worker,
        workerNeed: factory.employees.worker_need,
      }),
    ]);

    expect(summary.totalNeed).toBe(2);
    expect(summary.lack).toBe(2);
    expect(summary.understaffedBuildingIds).toContain(factoryId);
  });
});
