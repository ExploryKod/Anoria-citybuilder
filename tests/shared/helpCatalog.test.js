import { HELP } from '../../src/shared/help-catalog/HelpCatalog.js';
import { resolveHelp } from '../../src/presentation/dom/shell/HelpButton.js';

// A text and the figures it names cannot drift apart: every entry reads in every state it is written for, with exactly the figures it declares.
describe('help catalog', () => {
  for (const [id, entry] of Object.entries(HELP)) {
    for (const state of entry.states ?? [null]) {
      test(`${id} reads${state ? ` in the state "${state}"` : ''}`, () => {
        // A text figure is a word; the others are numbers.
        const figures = Object.fromEntries(Object.entries(entry.figures ?? {}).map(([name, kind]) => [name, kind === 'text' ? 'mot' : 1]));
        const help = resolveHelp(id, { state, figures });
        expect(help.message).not.toMatch(/\{\w+\}/);
      });
    }
  }

  test('every figure an entry declares is written by some state of it', () => {
    for (const [id, entry] of Object.entries(HELP)) {
      const written = JSON.stringify(entry.message) + JSON.stringify(entry.items ?? []);
      for (const name of Object.keys(entry.figures ?? {})) {
        expect({ id, name, written: written.includes(`{${name}}`) }).toEqual({ id, name, written: true });
      }
    }
  });

  test('a figure the entry does not name is refused', () => {
    expect(() => resolveHelp('city.trialBalance', { figures: { amount: 1 } })).toThrow(/does not name the figure/);
  });
});
