import { describe, test, expect } from '@jest/globals';
import { LiquidateInsolventCompanies } from '../../../src/contexts/gameplay/application/services/LiquidateInsolventCompanies.js';
import { createInsolvencySystem } from '../../../src/contexts/gameplay/infrastructure/runtime/insolvencySystem.js';
import { getBuildingDefinition } from '../../../src/shared/building-catalog/buildingCatalog.js';

// An insurance company that cannot pay its debts the grace months in a row is liquidated and demolished as the player's own demolition would be, and its place is free again.
const ROWS = [
  { instanceId: 'ins-1', type: 'Insurance', x: 3, y: 4, companyId: 'ano' },
  { instanceId: 'ins-2', type: 'Insurance', x: 8, y: 4, companyId: 'aby' },
  { instanceId: 'bank-1', type: 'Bank', x: 1, y: 1 },
];

function service({ months, refused = undefined, city = { tiles: [] } } = {}) {
  const bulldozed = [];
  const announced = [];
  const liquidating = new LiquidateInsolventCompanies({
    listAllBuildingRows: async () => ROWS,
    instanceIdFromHouseRow: (row) => row.instanceId,
    isLiquidatedWhenInsolvent: (type) => getBuildingDefinition(type)?.liquidatedWhenInsolvent === true,
    getInsolvency: async (id) => ({ months: months[id], graceMonths: 3 }),
    bulldozeBuildingAtTile: async (params) => {
      bulldozed.push(params);
      return { buildingId: 'Insurance', refused };
    },
    getGameCity: () => city,
    nameOfRow: (row) => `Compagnie ${row.companyId}`,
    announce: (event) => announced.push(event),
  });
  return { liquidating, bulldozed, announced };
}

describe('liquidating the insolvent companies', () => {
  test('the catalog says which buildings are liquidated when they cannot pay: the insurance companies, not the bank', () => {
    expect(getBuildingDefinition('Insurance').liquidatedWhenInsolvent).toBe(true);
    expect(getBuildingDefinition('Bank').liquidatedWhenInsolvent).toBeUndefined();
  });

  test('a company whose debts stayed open the grace months is demolished like the eraser does, announced, and the others are left alone', async () => {
    const { liquidating, bulldozed, announced } = service({ months: { 'ins-1': 3, 'ins-2': 2 } });

    const liquidated = await liquidating.execute();

    expect(liquidated).toEqual([{ instanceId: 'ins-1', name: 'Compagnie ano' }]);
    expect(bulldozed).toEqual([{ city: { tiles: [] }, x: 3, y: 4, meshInstanceId: 'ins-1' }]);
    expect(announced).toEqual([{ instanceId: 'ins-1', buildingType: 'Insurance', name: 'Compagnie ano', x: 3, y: 4 }]);
  });

  test('no one is liquidated while every company is under the grace months', async () => {
    const { liquidating, bulldozed } = service({ months: { 'ins-1': 2, 'ins-2': 0 } });

    expect(await liquidating.execute()).toEqual([]);
    expect(bulldozed).toEqual([]);
  });

  test('a refused demolition is a defect, never a silent skip', async () => {
    const { liquidating } = service({ months: { 'ins-1': 4, 'ins-2': 0 }, refused: 'building_undemolishable' });

    await expect(liquidating.execute()).rejects.toThrow(/cannot be liquidated/);
  });

  test('the system checks on the last day of the month only', async () => {
    const calls = [];
    const gameplay = { liquidateInsolventCompanies: { execute: async () => calls.push(true) } };
    const system = createInsolvencySystem({ gameplay, getTimeInfo: (time) => ({ dayInMonth: time }), getDaysPerMonth: () => 5 });

    for (const time of [1, 2, 3, 4]) await system({}, { time });
    expect(calls).toHaveLength(0);
    await system({}, { time: 5 });
    expect(calls).toHaveLength(1);
  });
});
