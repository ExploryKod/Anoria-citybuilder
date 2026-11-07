import { describe, test, expect, jest } from '@jest/globals';
import { LiquidateInsolventCompanies } from '../../../src/contexts/gameplay/application/services/LiquidateInsolventCompanies.js';
import { createInsolvencySystem } from '../../../src/contexts/gameplay/infrastructure/runtime/insolvencySystem.js';
import { getBuildingDefinition } from '../../../src/shared/building-catalog/buildingCatalog.js';

// An insurance company that cannot pay its debts the grace months in a row is liquidated and demolished as the player's own demolition would be, and its place is free again.
const ROWS = [
  { instanceId: 'ins-1', type: 'Insurance', x: 3, y: 4, companyId: 'ano' },
  { instanceId: 'ins-2', type: 'Insurance', x: 8, y: 4, companyId: 'aby' },
  { instanceId: 'bank-1', type: 'Bank', x: 1, y: 1 },
];

function service({ months, refused = undefined, city = { tiles: [] }, failingIds = [], nameOfRow = (row) => `Compagnie ${row.companyId}` } = {}) {
  const bulldozed = [];
  const announced = [];
  const reported = [];
  const liquidating = new LiquidateInsolventCompanies({
    listAllBuildingRows: async () => ROWS,
    instanceIdFromHouseRow: (row) => row.instanceId,
    isLiquidatedWhenInsolvent: (type) => getBuildingDefinition(type)?.liquidatedWhenInsolvent === true,
    getInsolvency: async (id) => ({ months: months[id], graceMonths: 3 }),
    bulldozeBuildingAtTile: async (params) => {
      if (failingIds.includes(params.meshInstanceId)) throw new Error('its books would not close');
      bulldozed.push(params);
      return { buildingId: 'Insurance', refused };
    },
    getGameCity: () => city,
    nameOfRow,
    announce: (event) => announced.push(event),
    reportFailure: (failure) => reported.push(failure),
  });
  return { liquidating, bulldozed, announced, reported };
}

describe('liquidating the insolvent companies', () => {
  test('the catalog says which buildings are liquidated when they cannot pay: the insurance companies, not the bank', () => {
    expect(getBuildingDefinition('Insurance').liquidatedWhenInsolvent).toBe(true);
    expect(getBuildingDefinition('Bank').liquidatedWhenInsolvent).toBeUndefined();
  });

  test('a company whose debts stayed open the grace months is demolished like the eraser does, announced, and the others are left alone', async () => {
    const { liquidating, bulldozed, announced } = service({ months: { 'ins-1': 3, 'ins-2': 2 } });

    const { liquidated } = await liquidating.execute();

    expect(liquidated).toEqual([{ instanceId: 'ins-1', name: 'Compagnie ano' }]);
    expect(bulldozed).toEqual([{ city: { tiles: [] }, x: 3, y: 4, meshInstanceId: 'ins-1' }]);
    expect(announced).toEqual([{ instanceId: 'ins-1', buildingType: 'Insurance', name: 'Compagnie ano', x: 3, y: 4 }]);
  });

  test('no one is liquidated while every company is under the grace months', async () => {
    const { liquidating, bulldozed } = service({ months: { 'ins-1': 2, 'ins-2': 0 } });

    expect(await liquidating.execute()).toEqual({ liquidated: [], failed: [] });
    expect(bulldozed).toEqual([]);
  });

  // Regression: a company that could not be liquidated used to throw out of the loop, so the next one was never looked at and the day's other systems did not run.
  test('a company that cannot be liquidated is reported and does not stop the others', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { liquidating, bulldozed, announced, reported } = service({ months: { 'ins-1': 4, 'ins-2': 5 }, failingIds: ['ins-1'] });

    const { liquidated, failed } = await liquidating.execute();

    expect(liquidated).toEqual([{ instanceId: 'ins-2', name: 'Compagnie aby' }]);
    expect(failed).toEqual([{ instanceId: 'ins-1', name: 'Compagnie ano', reason: 'its books would not close' }]);
    expect(reported).toEqual([{ instanceId: 'ins-1', buildingType: 'Insurance', name: 'Compagnie ano', reason: 'its books would not close' }]);
    expect(bulldozed.map((call) => call.meshInstanceId)).toEqual(['ins-2']);
    expect(announced.map((event) => event.instanceId)).toEqual(['ins-2']);
    consoleError.mockRestore();
  });

  // Regression: the company was named before its debts were tested, and every error became "bankrupt but could not be liquidated" — a false alarm for a healthy company.
  test('a healthy company is never told as bankrupt, and an error that is not the liquidation stops loudly', async () => {
    const named = [];
    const { liquidating, reported } = service({ months: { 'ins-1': 1, 'ins-2': 0 }, nameOfRow: (row) => { named.push(row.instanceId); throw new Error('no catalog name'); } });

    expect(await liquidating.execute()).toEqual({ liquidated: [], failed: [] });
    expect(named).toEqual([]);
    expect(reported).toEqual([]);

    const bankrupt = service({ months: { 'ins-1': 4, 'ins-2': 0 }, nameOfRow: () => { throw new Error('no catalog name'); } });
    await expect(bankrupt.liquidating.execute()).rejects.toThrow('no catalog name');
    expect(bankrupt.reported).toEqual([]);
  });

  test('a refused demolition is reported with its reason, never skipped in silence', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { liquidating, reported } = service({ months: { 'ins-1': 4, 'ins-2': 0 }, refused: 'building_undemolishable' });

    const { liquidated, failed } = await liquidating.execute();

    expect(liquidated).toEqual([]);
    expect(failed[0].reason).toMatch(/refused \(building_undemolishable\)/);
    expect(reported).toHaveLength(1);
    consoleError.mockRestore();
  });

  test('with no city on screen the liquidation is reported, not dropped', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { liquidating, bulldozed, reported } = service({ months: { 'ins-1': 4, 'ins-2': 0 }, city: null });

    await liquidating.execute();

    expect(bulldozed).toEqual([]);
    expect(reported[0].reason).toMatch(/no city on screen/);
    consoleError.mockRestore();
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
