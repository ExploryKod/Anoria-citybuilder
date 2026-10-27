/**
 * Regression: a crop was harvested in autumn and sold in December, but the cabbage keeps two months: it rotted in the field every November, before the granary came.
 * Every crop of the catalog that has a harvest season and a sale window must be sold before it goes bad.
 */
import { beforeEach, describe, expect, test } from '@jest/globals';
import { useDaysPerMonthForTests, useEnvDaysPerMonthForTests } from '../../../src/config/events.js';
import { TimeManager } from '../../../src/shared/time/TimeManager.js';
import { buildingCatalog } from '../../../src/shared/building-catalog/buildingCatalog.js';
import { getShelfLifeMonths } from '../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';
import { shelfLifeTurnsOf } from '../../../src/contexts/supply/domain/policies/StockAgingPolicy.js';
import { getCollectionSchedule } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { toSupplyMonth, toSupplySeason } from '../../../src/composition/supplyTimeLabels.js';

const DAYS_PER_MONTH = 5;

const monthNames = () => Array.from({ length: 12 }, (_, month) => toSupplyMonth(TimeManager.getTimeInfo(month * DAYS_PER_MONTH).month));
const seasonOfMonth = (month) => toSupplySeason(TimeManager.getTimeInfo(month * DAYS_PER_MONTH).season);

/** Every producer role that harvests in a season and sells in a window of its own. */
const seasonalCrops = Object.entries(buildingCatalog).flatMap(([type, definition]) =>
  (definition.resourceRoles ?? [])
    .filter((entry) => entry.role === 'producer' && entry.schedule?.unit === 'season' && entry.sale?.schedule?.unit === 'month')
    .map((entry) => ({ type, entry })),
);

describe('the crop calendar of the catalog', () => {
  // The setup resets the calendar before every test.
  beforeEach(() => {
    useEnvDaysPerMonthForTests(DAYS_PER_MONTH);
    useDaysPerMonthForTests(DAYS_PER_MONTH);
  });

  test('there are seasonal crops to check', () => {
    expect(seasonalCrops.length).toBeGreaterThan(0);
  });

  test.each(seasonalCrops.map(({ type, entry }) => [type, entry]))('%s is sold before it goes bad', (_type, entry) => {
    const category = entry.categories[0];
    const shelfLifeMonths = getShelfLifeMonths(category);
    if (shelfLifeMonths === Infinity) return;

    const months = monthNames();
    const harvestMonth = months.findIndex((_, month) => entry.schedule.values.includes(seasonOfMonth(month)));
    const saleMonth = entry.sale.schedule.values.map((name) => months.indexOf(name)).filter((month) => month >= harvestMonth).sort((a, b) => a - b)[0];
    expect(saleMonth).toBeDefined();

    // The harvest is made on the first day of its season; the stock is born on the tick that sees it, the day after. A granary keeps nothing it has not bought yet.
    const born = harvestMonth * DAYS_PER_MONTH + 1;
    const lifeTurns = shelfLifeTurnsOf({ shelfLifeMonths, factor: 1, daysPerMonth: DAYS_PER_MONTH });
    expect(saleMonth * DAYS_PER_MONTH).toBeLessThan(born + lifeTurns);
  });

  test('the granary collects in every month a crop it collects is sold in', () => {
    const collecting = getCollectionSchedule('Windmill-001').values;
    for (const { entry } of seasonalCrops.filter(({ entry: crop }) => ['wheat', 'carrot', 'cabbage'].includes(crop.categories[0]))) {
      for (const month of entry.sale.schedule.values) expect(collecting).toContain(month);
    }
  });
});
