import { describe, test, expect } from '@jest/globals';
import {
  getBarnProductStock,
  getBarnTotalStock,
  getBarnTotalCapacity,
  getBarnRemainingCapacity,
  canCreditBarnStock,
  canDebitBarnStock,
  creditBarnStock,
  debitBarnStock,
  isOperationalCommerceBarn,
  getBarnCapacitySummary,
} from '../../../../src/contexts/supply/domain/policies/BarnStockPolicy.js';
import {
  BARN_MAX_TOTAL_CAPACITY,
  BARN_UNITS_PER_WORKER,
  getBarnMaxWorkers,
  getBarnCapacityForWorkerCount,
} from '../../../../src/contexts/supply/domain/catalogs/BarnCommerceCatalog.js';

const barnWithTwoWorkers = {
  type: 'Barn-001',
  roads: 1,
  isActive: true,
  employees: { worker: 2, worker_need: 1 },
};

/** Each product may use the full barn capacity (C3-style max percent). */
const fullShareHubOrders = {
  wood: { mode: 'accept', maxPercent: 100 },
  furniture: { mode: 'accept', maxPercent: 100 },
  figs: { mode: 'accept', maxPercent: 100 },
};

describe('BarnStockPolicy', () => {
  test('capacity scales with workers (10 units per worker, all goods combined)', () => {
    const barn = { ...barnWithTwoWorkers, hubStorageOrders: fullShareHubOrders };
    expect(getBarnTotalCapacity(barn)).toBe(20);

    const stocks = { wood: 8, furniture: 4, figs: 0 };
    expect(getBarnTotalStock(stocks)).toBe(12);
    expect(getBarnRemainingCapacity(barn, stocks)).toBe(8);
    expect(canCreditBarnStock(barn, stocks, 'wood', 8)).toBe(true);
    expect(canCreditBarnStock(barn, stocks, 'wood', 9)).toBe(false);
  });

  test('default uses shared free space up to full capacity per product', () => {
    const stocks = { wood: 8, furniture: 4, figs: 0 };
    expect(canCreditBarnStock(barnWithTwoWorkers, stocks, 'wood', 8)).toBe(true);
    expect(canCreditBarnStock(barnWithTwoWorkers, stocks, 'wood', 9)).toBe(false);
    expect(canCreditBarnStock(barnWithTwoWorkers, stocks, 'figs', 8)).toBe(true);
    expect(canCreditBarnStock(barnWithTwoWorkers, stocks, 'figs', 9)).toBe(false);
  });

  test('hard cap at max goods even with max workers', () => {
    const fullBarn = {
      type: 'Barn-001',
      roads: 1,
      isActive: true,
      employees: { worker: getBarnMaxWorkers() },
    };
    expect(getBarnTotalCapacity(fullBarn)).toBe(BARN_MAX_TOTAL_CAPACITY);

    const overStaffed = { ...fullBarn, employees: { worker: getBarnMaxWorkers() + 2 } };
    expect(getBarnTotalCapacity(overStaffed)).toBe(BARN_MAX_TOTAL_CAPACITY);
    expect(getBarnCapacityForWorkerCount(getBarnMaxWorkers() + 2)).toBe(BARN_MAX_TOTAL_CAPACITY);
  });

  test('getBarnMaxWorkers is derived from source constants', () => {
    expect(getBarnMaxWorkers()).toBe(BARN_MAX_TOTAL_CAPACITY / BARN_UNITS_PER_WORKER);
  });

  test('credit and debit barn commerce stocks', () => {
    const barn = {
      ...barnWithTwoWorkers,
      employees: { worker: 1 },
      hubStorageOrders: fullShareHubOrders,
    };
    const stocks = { wood: 6, furniture: 0, figs: 0 };

    expect(getBarnRemainingCapacity(barn, stocks)).toBe(4);
    expect(creditBarnStock(barn, stocks, 'figs', 4)).toEqual({
      wood: 6,
      furniture: 0,
      figs: 4,
    });

    expect(canDebitBarnStock(stocks, 'wood', 3)).toBe(true);
    expect(debitBarnStock({ wood: 6, furniture: 0, figs: 4 }, 'wood', 3)).toEqual({
      wood: 3,
      furniture: 0,
      figs: 4,
    });
  });

  test('isOperationalCommerceBarn requires road access, active barn and workers', () => {
    expect(isOperationalCommerceBarn(barnWithTwoWorkers)).toBe(true);
    expect(
      isOperationalCommerceBarn({ type: 'Barn-001', roads: 1, isActive: true, employees: { worker: 0 } })
    ).toBe(false);
    expect(
      isOperationalCommerceBarn({ type: 'Barn-001', roads: 0, isActive: true, employees: { worker: 1 } })
    ).toBe(false);
    expect(
      isOperationalCommerceBarn({ type: 'Windmill-001', roads: 1, isActive: true, employees: { worker: 1 } })
    ).toBe(false);
    expect(
      isOperationalCommerceBarn({
        type: 'Barn-001',
        supplyFlow: 'city',
        roads: 1,
        isActive: true,
        employees: { worker: 2 },
      })
    ).toBe(false);
  });

  test('getBarnCapacitySummary for info panel', () => {
    const summary = getBarnCapacitySummary(barnWithTwoWorkers, { wood: 3, furniture: 2, figs: 1 });
    expect(summary).toEqual({
      workers: 2,
      maxWorkers: getBarnMaxWorkers(),
      maxTotal: 20,
      maxGoods: BARN_MAX_TOTAL_CAPACITY,
      currentTotal: 6,
      remainingTotal: 14,
      unitsPerWorker: BARN_UNITS_PER_WORKER,
    });
  });

  test('getBarnProductStock normalizes missing keys', () => {
    expect(getBarnProductStock({}, 'figs')).toBe(0);
  });
});
