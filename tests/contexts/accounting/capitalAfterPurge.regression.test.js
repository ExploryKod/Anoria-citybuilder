import { describe, test, expect } from '@jest/globals';
import { InitializeTreasury } from '../../../src/contexts/accounting/application/commands/treasury/InitializeTreasury.js';

// Regression: after a purge the capital line is folded into a year closing and its business key is gone. Each boot then
// recorded the starting capital again (+500), and each purge closed it again: ten phantom closings of year 0.
describe('the starting capital is recorded once, into an empty journal only', () => {
  const build = (hasEntries) => {
    const recorded = [];
    const initialize = new InitializeTreasury(
      { execute: async (line) => { recorded.push(line); return { recorded: true }; } },
      500,
      { hasAnyEntry: async () => hasEntries },
    );
    return { initialize, recorded };
  };

  test('an empty journal receives the capital', async () => {
    const { initialize, recorded } = build(false);
    await initialize.execute(500);
    expect(recorded).toHaveLength(1);
  });

  test('a journal that already holds a line (even only a year closing) receives nothing', async () => {
    const { initialize, recorded } = build(true);
    await expect(initialize.execute(500)).resolves.toMatchObject({ recorded: false });
    expect(recorded).toHaveLength(0);
  });
});
