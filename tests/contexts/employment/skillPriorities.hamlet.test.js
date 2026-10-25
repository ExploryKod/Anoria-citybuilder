/**
 * Tests — Employment: the skill priorities are a hamlet's own.
 *
 * Priorités par SKILL (une par activité, scoped à l'onglet groupe social qui la fournit, voir SkillPriorityPolicy.js), rangées sur la ligne du
 * hameau : chaque hameau a les siennes, le joueur règle celles du hameau où il est.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createEmploymentContext } from '../../../src/composition/createEmploymentContext.js';
import { DexieHamletSkillPriorityRepository } from '../../../src/contexts/employment/infrastructure/dexie/DexieHamletSkillPriorityRepository.js';
import { useHamletForTests } from '../../../src/core/persistence/hamlet/hamletSession.js';

/** A fake `hamlets` table: rows by id, with the two calls the repository makes. */
function fakeDatabase(rows = {}) {
  return {
    rows,
    hamlets: {
      get: async (id) => rows[id] ?? undefined,
      update: async (id, patch) => {
        rows[id] = { ...rows[id], ...patch };
      },
    },
  };
}

describe('Employment skill priorities — one set per hamlet', () => {
  let database;
  let employment;

  beforeEach(async () => {
    database = fakeDatabase({ 'hamlet-a': { id: 'hamlet-a' }, 'hamlet-b': { id: 'hamlet-b' } });
    employment = createEmploymentContext({
      employmentBuildingRepository: {},
      skillPriorityRepository: new DexieHamletSkillPriorityRepository(database),
    });
    useHamletForTests('hamlet-a');
    await employment.loadSkillPriorities('hamlet-a');
  });

  test('a hamlet whose player changed nothing has the catalog\'s default ranks (an integer from 1)', () => {
    const priority = employment.getSkillPriority('fermier');
    expect(Number.isInteger(priority)).toBe(true);
    expect(priority).toBeGreaterThanOrEqual(1);
    expect(employment.getSkillPriority('')).toBe(99);
  });

  test('every skill of every tab has a rank in the flat map the redistribution reads', () => {
    const priorities = employment.getAllSkillPriorities();
    for (const skill of ['fermier', 'vente-alimentaire', 'stockage-alimentaire', 'hydraulique']) {
      expect(priorities[skill]).toBeDefined();
    }
  });

  test('a rank set in one hamlet stays in that hamlet, is kept on its row, and is read back when the hamlet is loaded again', async () => {
    const before = employment.getSkillPriority('fermier');
    employment.updateSkillPrioritySync('fermier', before === 1 ? 2 : 1);
    const changed = employment.getSkillPriority('fermier');
    expect(changed).not.toBe(before);
    await Promise.resolve();
    expect(database.rows['hamlet-a'].employmentSkillPriorities.fermier).toBe(changed);

    // Another hamlet is untouched: its own default.
    useHamletForTests('hamlet-b');
    await employment.loadSkillPriorities('hamlet-b');
    expect(employment.getSkillPriority('fermier')).toBe(before);
    expect(database.rows['hamlet-b'].employmentSkillPriorities).toBeUndefined();

    // Back in the first one, from its row alone.
    const reopened = createEmploymentContext({
      employmentBuildingRepository: {},
      skillPriorityRepository: new DexieHamletSkillPriorityRepository(database),
    });
    useHamletForTests('hamlet-a');
    await reopened.loadSkillPriorities('hamlet-a');
    expect(reopened.getSkillPriority('fermier')).toBe(changed);
  });

  test('asking for the priorities of a hamlet that was not loaded throws instead of answering the defaults', () => {
    useHamletForTests('hamlet-b');
    expect(() => employment.getSkillPriority('fermier')).toThrow(/hamlet-b.*not loaded/);
  });

  test('two skills of two different tabs can share a rank: a tab is its own labour pool', async () => {
    const priorities = new DexieHamletSkillPriorityRepository(fakeDatabase({ 'hamlet-a': { id: 'hamlet-a', employmentSkillPriorities: { fermier: 1, 'vente-alimentaire': 1 } } }));
    const shared = createEmploymentContext({ employmentBuildingRepository: {}, skillPriorityRepository: priorities });
    await shared.loadSkillPriorities('hamlet-a');
    expect(shared.getSkillPriority('fermier')).toBe(1);
    expect(shared.getSkillPriority('vente-alimentaire')).toBe(1);
  });
});
