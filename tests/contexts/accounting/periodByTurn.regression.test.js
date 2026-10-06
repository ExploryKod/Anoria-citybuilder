import { describe, test, expect } from '@jest/globals';
import { GetGeneralLedger } from '../../../src/contexts/accounting/application/queries/journal/GetGeneralLedger.js';

// A period is a number of turns (a turn is a day), counted from the running game's turn: never from the wall clock.
describe('journal period — the last N turns, from the current turn', () => {
  test('a 3-day period keeps the entries of the last three turns and no older one', async () => {
    const entries = [1, 6, 7, 8, 9, 10].map((turn, index) => ({
      id: index + 1,
      turn,
      type: 'citizen_tax',
      amount: 1,
      description: `Entrée ${turn}`,
      date: new Date().toISOString(),
    }));
    const query = new GetGeneralLedger(
      { getJournalEntries: async () => entries },
      { execute: async () => ({ funds: 0 }) },
      {
        currentTurn: () => 10,
        getTimeInfo: (turn) => ({ year: 0, month: 'Janvier', monthIndex: 0, turn }),
      }
    );

    const view = await query.execute({ periodDays: 3 });

    const turns = JSON.stringify(view).match(/"turn":(\d+)/g)?.map((text) => Number(text.split(':')[1])) ?? [];
    expect([...new Set(turns)].sort((a, b) => a - b)).toEqual([8, 9, 10]);
  });
});
