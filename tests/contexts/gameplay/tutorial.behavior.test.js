/**
 * Behavior tests — Gameplay: the tutorial's script and the service that advances it.
 */

import { describe, test, expect } from '@jest/globals';
import { TUTORIAL_STEPS } from '../../../src/contexts/gameplay/domain/catalogs/TutorialCatalog.js';
import {
  currentTutorialStep,
  tutorialDraftOf,
  validateTutorialSteps,
} from '../../../src/contexts/gameplay/domain/policies/TutorialProgressPolicy.js';
import { AdvanceTutorial } from '../../../src/contexts/gameplay/application/services/AdvanceTutorial.js';

const building = (type, extra = {}) => ({ type, pop: 0, workers: 0, workerNeed: 0, ...extra });

describe('the tutorial script', () => {
  // The catalog changes with the game: a building renamed or removed, or a skill dropped, must fail here and name the step.
  test('the real catalog is valid and every dépêche resolves its words from the catalogs', () => {
    expect(() => validateTutorialSteps(TUTORIAL_STEPS)).not.toThrow();
    for (const step of TUTORIAL_STEPS.filter((s) => s.news)) {
      const draft = tutorialDraftOf(step);
      expect(draft.body).not.toMatch(/[{}]/);
    }
  });

  test('a step that names a building the catalog does not have throws, naming it', () => {
    const steps = [{ id: 'ghost', done: [{ built: 'Castle-404' }], news: null }];
    expect(() => validateTutorialSteps(steps)).toThrow(/Castle-404/);
  });

  test('a step without `news` is refused: a silent step says null', () => {
    expect(() => validateTutorialSteps([{ id: 'x', done: [{ built: 'House-Mayor' }] }])).toThrow(/news/);
  });

  test('the step the player is on is the first one not done, until the script is over', () => {
    const steps = [
      { id: 'first', done: [{ built: 'House-Mayor' }], news: null },
      { id: 'second', done: [{ built: 'House-Red' }], news: null },
    ];
    expect(currentTutorialStep(steps, { buildings: [] }).id).toBe('first');
    expect(currentTutorialStep(steps, { buildings: [building('House-Mayor')] }).id).toBe('second');
    expect(currentTutorialStep(steps, { buildings: [building('House-Mayor'), building('House-Red')] })).toBeNull();
  });

  test('a house is housed once it has residents, a building is staffed once its workers meet its need', () => {
    const steps = [{ id: 'both', done: [{ housed: 'House-Red' }, { staffed: 'Farm-Wheat' }], news: null }];
    const idle = { buildings: [building('House-Red'), building('Farm-Wheat', { workerNeed: 3, workers: 1 })] };
    const ready = { buildings: [building('House-Red', { pop: 2 }), building('Farm-Wheat', { workerNeed: 3, workers: 3 })] };
    expect(currentTutorialStep(steps, idle).id).toBe('both');
    expect(currentTutorialStep(steps, ready)).toBeNull();
  });
});

describe('AdvanceTutorial', () => {
  const steps = [
    { id: 'mayor', done: [{ built: 'House-Mayor' }], news: null },
    { id: 'artisans', done: [{ built: 'House-Red' }], news: { title: 'Les bras', body: 'Bâtissez {building:House-Red}.', teaser: 't', action: { kind: 'buildTool', toolId: 'House-Red' } } },
  ];

  function service({ active = true, buildings = [] } = {}) {
    const announced = [];
    const advance = new AdvanceTutorial({
      steps,
      isActive: () => active,
      facts: { read: async () => ({ buildings }) },
      announcer: { announce: async (guidance) => { announced.push(guidance); return guidance; } },
      getGameTime: () => 7,
    });
    return { advance, announced };
  }

  test('gives the instruction of the step the player is on, its words taken from the catalog', async () => {
    const { advance, announced } = service({ buildings: [building('House-Mayor')] });
    await advance.execute();
    expect(announced).toHaveLength(1);
    expect(announced[0]).toMatchObject({ stepId: 'artisans', turn: 7, body: 'Bâtissez Artisans.', action: { kind: 'buildTool', toolId: 'House-Red' } });
  });

  test('says nothing while the step is a silent one, and nothing outside a tutorial game', async () => {
    const silent = service({ buildings: [] });
    await silent.advance.execute();
    expect(silent.announced).toEqual([]);

    const notTutorial = service({ active: false, buildings: [building('House-Mayor')] });
    await notTutorial.advance.execute();
    expect(notTutorial.announced).toEqual([]);
  });
});
