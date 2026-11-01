import { describe, test, expect } from '@jest/globals';
import { RunMonthlyForestGrowth } from '../../../src/contexts/supply/application/commands/RunMonthlyForestGrowth.js';
import { PLANTATION_PROP_IDS } from '../../../src/shared/editor-catalog/naturePropCatalog.js';
import { MONTHS_PER_YEAR } from '../../../src/shared/time/TimeCalendar.js';

// A forest plot an owner bought: a plant, a tree a year later (100), a high tree the year after (200); a tree used up leaves the tile fallow for a month, then a plant again.
const GOOD = 'timber';

function forest() {
  const state = { plots: [{ x: 3, y: 4, use: 'forest', owner: 'jack', crop: null, groundY: 0.5 }], record: null, nextId: 1 };
  const run = new RunMonthlyForestGrowth({
    listPlots: async () => state.plots,
    savePlots: async (plots) => { state.plots = plots; },
    findRecordAt: async () => state.record,
    createRecord: async ({ prop, stocks, groundY }) => { state.record = { id: `r${state.nextId++}`, prop, stocks: { ...stocks }, groundY }; },
    changeRecord: async (_id, { prop, stocks }) => { state.record = { ...state.record, prop, stocks: { ...stocks } }; },
    resourceOf: async (buyerId) => (buyerId === 'jack' ? GOOD : null),
  });
  const month = (n) => run.execute({ year: Math.floor(n / MONTHS_PER_YEAR), monthIndex: n % MONTHS_PER_YEAR });
  return { state, month };
}

describe('the forest an owner planted grows tile by tile', () => {
  test('a plant, then a tree after a year, then a high tree after another; each holds what the use says', async () => {
    const { state, month } = forest();
    await month(0);
    expect(state.record).toMatchObject({ prop: PLANTATION_PROP_IDS.plant, stocks: {}, groundY: 0.5 });

    await month(MONTHS_PER_YEAR - 1);
    expect(state.record.prop).toBe(PLANTATION_PROP_IDS.plant);
    await month(MONTHS_PER_YEAR);
    expect(state.record).toMatchObject({ prop: PLANTATION_PROP_IDS.tree, stocks: { [GOOD]: 100 } });

    await month(2 * MONTHS_PER_YEAR);
    expect(state.record).toMatchObject({ prop: PLANTATION_PROP_IDS.treeHigh, stocks: { [GOOD]: 200 } });
  });

  test('a tree used up leaves the tile fallow for a month, then a plant is set again', async () => {
    const { state, month } = forest();
    await month(0);
    await month(MONTHS_PER_YEAR);
    state.record = null; // the lumberjacks took the whole tree
    await month(MONTHS_PER_YEAR + 1);
    expect(state.plots[0].crop.stage).toBe('fallow');
    expect(state.record).toBeNull();

    await month(MONTHS_PER_YEAR + 2);
    expect(state.plots[0].crop.stage).toBe('plant');
    expect(state.record.prop).toBe(PLANTATION_PROP_IDS.plant);
  });

  test('land still for sale grows nothing', async () => {
    const { state, month } = forest();
    state.plots = [{ ...state.plots[0], owner: null }];
    await month(0);
    expect(state.record).toBeNull();
  });
});
