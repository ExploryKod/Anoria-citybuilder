/**
 * Behavior tests — Gameplay: the tutorial's script and the service that advances it.
 */

import { describe, test, expect } from '@jest/globals';
import { TUTORIAL_DISPATCHES, TUTORIAL_STEPS, TUTORIAL_TOASTS } from '../../../src/contexts/gameplay/domain/catalogs/TutorialCatalog.js';
import {
  currentTutorialStep,
  tutorialDraftOf,
  tutorialToastOf,
  validateTutorialDispatches,
  validateTutorialSteps,
  validateTutorialToasts,
} from '../../../src/contexts/gameplay/domain/policies/TutorialProgressPolicy.js';
import { AdvanceTutorial } from '../../../src/contexts/gameplay/application/services/AdvanceTutorial.js';

const building = (type, extra = {}) => ({ type, pop: 0, workers: 0, workerNeed: 0, ...extra });

describe('the tutorial script', () => {
  // The catalog changes with the game: a building renamed or removed, or a skill dropped, must fail here and name the step.
  test('the real catalog is valid and every dépêche and toast resolves its words from the catalogs', () => {
    expect(() => validateTutorialSteps(TUTORIAL_STEPS)).not.toThrow();
    expect(() => validateTutorialToasts(TUTORIAL_TOASTS, TUTORIAL_STEPS)).not.toThrow();
    expect(() => validateTutorialDispatches(TUTORIAL_DISPATCHES, TUTORIAL_STEPS)).not.toThrow();
    for (const dispatch of TUTORIAL_DISPATCHES) {
      expect(tutorialDraftOf(dispatch).body).not.toMatch(/[{}]/);
    }
    for (const step of TUTORIAL_STEPS.filter((s) => s.news)) {
      expect(tutorialDraftOf(step).body).not.toMatch(/[{}]/);
    }
    for (const toast of TUTORIAL_TOASTS) {
      expect(tutorialToastOf(toast).text).not.toMatch(/[{}]/);
    }
  });

  test('a step that names a building the catalog does not have throws, naming it', () => {
    const steps = [{ id: 'ghost', done: [{ built: 'Castle-404' }], news: null }];
    expect(() => validateTutorialSteps(steps)).toThrow(/Castle-404/);
  });

  test('a step without `news` is refused: a silent step says null', () => {
    expect(() => validateTutorialSteps([{ id: 'x', delay: 0, done: [{ built: 'House-Mayor' }] }])).toThrow(/news/);
  });

  test('a button is unlocked by a dépêche: a silent step cannot unlock one, and an unknown building throws', () => {
    expect(() => validateTutorialSteps([{ id: 'x', delay: 0, done: [{ built: 'House-Mayor' }], unlocks: ['House-Red'], news: null }])).toThrow(/"x".*unlocks/);
    const news = { title: 'T', body: 'b', teaser: 't', blocking: false };
    expect(() => validateTutorialSteps([{ id: 'x', delay: 0, done: [{ built: 'House-Mayor' }], unlocks: ['Castle-404'], news }])).toThrow(/Castle-404/);
  });

  // Nothing is assumed when the catalog stays silent: a missing `delay`, `blocking` or counter `after` throws, naming the entry.
  test('a step, a toast or a dépêche that does not say its `delay`, `blocking` or `after` is refused', () => {
    expect(() => validateTutorialSteps([{ id: 'x', done: [{ built: 'House-Mayor' }], news: null }])).toThrow(/"x".*delay/);
    const toast = { id: 't', kind: 'info', duration: 3000, priority: 1, step: 'x', text: 'x' };
    expect(() => validateTutorialToasts([toast], [{ id: 'x' }])).toThrow(/"t".*delay/);
    expect(() => validateTutorialToasts([{ ...toast, delay: 0, priority: undefined }], [{ id: 'x' }])).toThrow(/"t".*priority/);
    const news = { title: 'T', body: 'b', teaser: 't' };
    expect(() => validateTutorialDispatches([{ id: 'd', delay: 0, when: [{ built: 'House-Red' }], news }], [])).toThrow(/"d".*blocking/);
    const counter = { label: 'x', items: [{ type: 'House-Red', atLeast: 1 }] };
    expect(() => validateTutorialSteps([{ id: 'c', delay: 0, counter, done: [{ built: 'House-Red' }], news: null }])).toThrow(/"c".*after/);
  });

  test('the step the player is on is the first one not done, until the script is over', () => {
    const steps = [
      { id: 'first', done: [{ built: 'House-Mayor' }], news: null },
      { id: 'second', done: [{ built: { type: 'House-Red', atLeast: 2 } }], news: null },
    ];
    expect(currentTutorialStep(steps, { buildings: [] }).id).toBe('first');
    expect(currentTutorialStep(steps, { buildings: [building('House-Mayor'), building('House-Red')] }).id).toBe('second');
    expect(currentTutorialStep(steps, { buildings: [building('House-Mayor'), building('House-Red'), building('House-Red')] })).toBeNull();
  });

  test('a house is housed once it has residents, a building is staffed once its workers meet its need', () => {
    const steps = [{ id: 'both', done: [{ housed: 'House-Red' }, { staffed: 'Farm-Wheat' }], news: null }];
    const idle = { buildings: [building('House-Red'), building('Farm-Wheat', { workerNeed: 3, workers: 1 })] };
    const ready = { buildings: [building('House-Red', { pop: 2 }), building('Farm-Wheat', { workerNeed: 3, workers: 3 })] };
    expect(currentTutorialStep(steps, idle).id).toBe('both');
    expect(currentTutorialStep(steps, ready)).toBeNull();
  });

  // How many fields the houses need is the catalog's arithmetic (a field's yield, a citizen's need, a house's capacity), never a count typed in the script.
  test('the fields feed the houses when their harvest covers what the houses eat, whatever the count it takes', () => {
    const steps = [{ id: 'fed', done: [{ foodCovered: 'built' }], news: null }];
    const houses = [building('House-Mayor'), building('House-Red'), building('House-Red'), building('House-Blue'), building('House-Blue')];
    const oneField = { buildings: [...houses, building('Farm-Wheat')] };
    const twoFields = { buildings: [...houses, building('Farm-Wheat'), building('Farm-Wheat')] };
    expect(currentTutorialStep(steps, { buildings: houses }).id).toBe('fed');
    expect(currentTutorialStep(steps, oneField).id).toBe('fed');
    expect(currentTutorialStep(steps, twoFields)).toBeNull();
  });
});

describe('AdvanceTutorial', () => {
  const steps = [
    { id: 'mayor', delay: 0, done: [{ built: 'House-Mayor' }], news: null },
    { id: 'artisans', delay: 0, unlocks: ['House-Red'], done: [{ built: 'House-Red' }], news: { title: 'Les bras', body: 'Bâtissez « {building:House-Red} ».', teaser: 't', blocking: false, action: { kind: 'buildTool', toolId: 'House-Red' } } },
  ];
  const toasts = [
    { id: 'market-staffed', kind: 'success', duration: 5000, delay: 0, priority: 1, when: [{ staffed: 'Market-Stall-Red' }], text: '« {building:Market-Stall-Red} » est pourvu !' },
  ];

  function service({ active = true, buildings = [], script = steps, dispatches = [] } = {}) {
    const announced = [];
    const state = { buildings, time: 7, read: new Set() };
    const advance = new AdvanceTutorial({
      steps: script,
      dispatches,
      toasts,
      startTools: ['House-Mayor'],
      isActive: () => active,
      facts: { read: async () => ({ buildings: state.buildings }) },
      announcer: {
        announce: async (guidance) => { announced.push(guidance); return guidance; },
        wasAnnounced: async (id) => announced.some((guidance) => guidance.stepId === id),
        wasRead: async (id) => state.read.has(id),
      },
      getGameTime: () => state.time,
    });
    return { advance, announced, state };
  }

  test('the counter of a step goes 1/3, 2/3, then 3/3 is handed over as just completed when the step is done', async () => {
    const script = [
      { id: 'mayor', delay: 0, done: [{ built: 'House-Mayor' }], news: null },
      {
        id: 'houses',
        delay: 0,
        counter: { after: null, label: 'Maisons « {building:House-Red} »', items: [{ type: 'House-Red', atLeast: 3 }] },
        done: [{ built: { type: 'House-Red', atLeast: 3 } }],
        news: null,
      },
      { id: 'next', delay: 0, done: [{ built: { type: 'House-Red', atLeast: 9 } }], news: null },
    ];
    const { advance, state } = service({ buildings: [building('House-Mayor'), building('House-Red')], script });
    expect((await advance.execute()).progress).toEqual({ label: 'Maisons « Artisans »', have: 1, target: 3 });
    state.buildings = [building('House-Mayor'), building('House-Red'), building('House-Red')];
    expect((await advance.execute()).progress).toMatchObject({ have: 2, target: 3 });
    state.buildings = [...state.buildings, building('House-Red')];
    const done = await advance.execute();
    expect(done.justCompleted).toEqual({ label: 'Maisons « Artisans »', have: 3, target: 3 });
    expect(done.progress).toBeNull();
  });

  test('the counter of a step with a dépêche shows only once the player got past that dépêche', async () => {
    const script = [
      {
        id: 'houses',
        delay: 0,
        counter: { after: null, label: 'Maisons', items: [{ type: 'House-Red', atLeast: 3 }] },
        done: [{ built: { type: 'House-Red', atLeast: 3 } }],
        news: { title: 'T', body: 'b', teaser: 't', blocking: false },
      },
    ];
    const { advance, state } = service({ buildings: [building('House-Red')], script });
    expect((await advance.execute()).progress).toBeNull();
    state.read.add('houses');
    expect((await advance.execute()).progress).toEqual({ label: 'Maisons', have: 1, target: 3 });
  });

  test('the counter of a step with an `after` shows only once the dépêche it names has been read', async () => {
    const news = { title: 'T', body: 'b', teaser: 't', blocking: false };
    const script = [
      {
        id: 'trade',
        delay: 0,
        counter: { after: { news: 'chain' }, label: 'Marché', items: [{ type: 'Market-Stall-Red', atLeast: 1 }] },
        done: [{ built: 'Market-Stall-Red' }],
        news: null,
      },
    ];
    const { advance, state } = service({ script, dispatches: [{ id: 'chain', step: 'trade', delay: 0, news }] });
    expect((await advance.execute()).progress).toBeNull();
    state.read.add('chain');
    expect((await advance.execute()).progress).toEqual({ label: 'Marché', have: 0, target: 1 });
  });

  test('a counter whose `after` names a dépêche or a toast that does not exist throws, naming the step', () => {
    const script = [
      { id: 'trade', delay: 0, counter: { after: { news: 'ghost' }, label: 'x', items: [{ type: 'House-Red', atLeast: 1 }] }, done: [{ built: 'House-Red' }], news: null },
    ];
    expect(() => service({ script })).toThrow(/trade.*ghost/);
  });

  test('only the start tools work until a dépêche unlocks a building, and nothing is restricted once the script is over', async () => {
    const news = { title: 'T', body: 'b', teaser: 't', blocking: false };
    const dispatches = [{ id: 'needs-blue', delay: 0, when: [{ built: 'House-Red' }], unlocks: ['House-Blue'], news }];
    const { advance, state } = service({ buildings: [building('House-Mayor')], dispatches });
    // The mayor's house stands: the step of the artisans comes, and its dépêche unlocks their house.
    expect((await advance.execute()).allowed).toEqual(['House-Mayor', 'House-Red']);
    state.buildings = [building('House-Mayor'), building('House-Red')];
    expect((await advance.execute()).allowed).toEqual(null);
  });

  test('a game reopened mid-tutorial has the buttons of the dépêches already written', async () => {
    const news = { title: 'T', body: 'b', teaser: 't', blocking: false };
    const dispatches = [{ id: 'needs-blue', delay: 0, when: [{ built: 'House-Purple' }], unlocks: ['House-Blue'], news }];
    const { advance, state } = service({ buildings: [building('House-Mayor')], dispatches });
    await advance.execute();
    // A new session: nothing is remembered but what the announcer filed.
    const reopened = new AdvanceTutorial({
      steps, dispatches, toasts, startTools: ['House-Mayor'], isActive: () => true,
      facts: { read: async () => ({ buildings: state.buildings }) },
      announcer: { announce: async () => null, wasAnnounced: async (id) => id === 'artisans' || id === 'needs-blue', wasRead: async () => false },
      getGameTime: () => state.time,
    });
    expect((await reopened.execute()).allowed).toEqual(['House-Mayor', 'House-Red', 'House-Blue']);
  });

  test('a dispatch comes when its moment comes, whichever step the player is on, after its delay', async () => {
    const news = { title: 'T', body: 'Un « {building:House-Red} ».', teaser: 't', blocking: false, illustrations: ['House-Red'] };
    const dispatches = [
      { id: 'on-build', delay: 0, when: [{ built: 'House-Red' }], news },
      { id: 'later', step: 'artisans', delay: 2, news },
    ];
    const { advance, announced, state } = service({ buildings: [building('House-Mayor')], dispatches });
    await advance.execute();
    expect(announced.map((a) => a.stepId)).not.toContain('on-build');
    expect(announced.map((a) => a.stepId)).not.toContain('later');
    state.buildings = [building('House-Mayor'), building('House-Red')];
    await advance.execute();
    expect(announced.map((a) => a.stepId)).toContain('on-build');
    expect(announced.find((a) => a.stepId === 'on-build')).toMatchObject({ body: 'Un « Artisans ».', illustrations: ['House-Red'] });
    expect(announced.map((a) => a.stepId)).not.toContain('later');
    state.time = 9;
    await advance.execute();
    expect(announced.map((a) => a.stepId)).toContain('later');
  });

  test('a step with a delay gives its instruction only that many turns after the player reached it', async () => {
    const delayed = [steps[0], { ...steps[1], delay: 3 }];
    const { advance, announced, state } = service({ buildings: [building('House-Mayor')], script: delayed });
    expect((await advance.execute()).news).toBeNull();
    state.time = 9;
    expect((await advance.execute()).news).toBeNull();
    state.time = 10;
    expect((await advance.execute()).news).toBe(announced[0]);
  });

  test('gives the instruction of the step the player is on, its words taken from the catalog', async () => {
    const { advance, announced } = service({ buildings: [building('House-Mayor')] });
    const { news } = await advance.execute();
    expect(announced).toHaveLength(1);
    expect(news).toBe(announced[0]);
    expect(announced[0]).toMatchObject({ stepId: 'artisans', turn: 7, body: 'Bâtissez « Artisans ».', action: { kind: 'buildTool', toolId: 'House-Red' } });
  });

  test('says nothing while the step is a silent one, and nothing outside a tutorial game', async () => {
    const silent = service({ buildings: [] });
    expect(await silent.advance.execute()).toEqual({ news: null, toasts: [], dismissed: [], allowed: ['House-Mayor'], progress: null, justCompleted: null });
    expect(silent.announced).toEqual([]);

    const notTutorial = service({ active: false, buildings: [building('House-Mayor')] });
    expect(await notTutorial.advance.execute()).toEqual({ news: null, toasts: [], dismissed: [], allowed: null, progress: null, justCompleted: null });
    expect(notTutorial.announced).toEqual([]);
  });

  test('a step reminds the player what it asks after a while, again every so often, and the reminder goes with the step', async () => {
    const script = [
      { id: 'mayor', delay: 0, done: [{ built: 'House-Mayor' }], news: null },
      { id: 'artisans', delay: 0, done: [{ built: 'House-Red' }], news: null, reminder: { after: 5, every: 10, duration: 4000, text: 'Bâtissez « {building:House-Red} ».' } },
    ];
    const { advance, state } = service({ buildings: [building('House-Mayor')], script });
    const ids = async () => (await advance.execute()).toasts.map((t) => t.id);
    state.time = 1;
    expect(await ids()).toEqual([]);
    state.time = 5;
    expect(await ids()).toEqual([]);
    state.time = 6;
    expect(await advance.execute()).toMatchObject({ toasts: [{ id: 'reminder:artisans', kind: 'warning', duration: 4000, text: 'Bâtissez « Artisans ».' }] });
    state.time = 10;
    expect(await ids()).toEqual([]);
    state.time = 16;
    expect(await ids()).toEqual(['reminder:artisans']);
    state.buildings = [building('House-Mayor'), building('House-Red')];
    expect((await advance.execute()).dismissed).toEqual(['reminder:artisans']);
  });

  test('a blocking dépêche without a button to leave by is refused', () => {
    const news = { title: 'T', body: 'b', teaser: 't', blocking: true };
    expect(() => validateTutorialDispatches([{ id: 'x', delay: 0, when: [{ built: 'House-Red' }], news }], [])).toThrow(/action/);
  });

  test('a toast is taken off once the player did what it points at, and not shown at all if they already had', async () => {
    const pointing = [{ id: 'build-it', kind: 'info', duration: 5000, delay: 0, priority: 3, step: 'artisans', until: [{ built: 'House-Red' }], text: 'x' }];
    const make = (buildings) => {
      const state = { buildings, time: 1 };
      const advance = new AdvanceTutorial({
        steps,
        dispatches: [],
        toasts: pointing,
        startTools: ['House-Mayor'],
        isActive: () => true,
        facts: { read: async () => ({ buildings: state.buildings }) },
        announcer: { announce: async () => null, wasAnnounced: async () => false },
        getGameTime: () => state.time,
      });
      return { advance, state };
    };

    const { advance, state } = make([]);
    await advance.execute();
    state.buildings = [building('House-Mayor')];
    expect((await advance.execute()).toasts.map((t) => t.id)).toEqual(['build-it']);
    state.buildings = [building('House-Mayor'), building('House-Red')];
    const after = await advance.execute();
    expect(after.dismissed).toEqual(['build-it']);
    expect((await advance.execute()).dismissed).toEqual([]);

    const already = make([]);
    await already.advance.execute();
    already.state.buildings = [building('House-Mayor'), building('House-Red')];
    expect(await already.advance.execute()).toMatchObject({ toasts: [], dismissed: [] });
  });

  test('a toast can be tied to a step and to the calendar, and a bad one throws naming it', () => {
    const tied = { id: 't', kind: 'info', duration: 3000, delay: 0, priority: 1, step: 'artisans', when: [{ season: 'Automne' }, { turnAtLeast: 10 }], text: 'x' };
    expect(() => validateTutorialToasts([tied], steps)).not.toThrow();
    expect(() => validateTutorialToasts([{ ...tied, step: 'nope' }], steps)).toThrow(/nope/);
    expect(() => validateTutorialToasts([{ ...tied, when: [{ season: 'Mousson' }] }], steps)).toThrow(/Mousson/);
    expect(() => validateTutorialToasts([{ ...tied, duration: undefined }], steps)).toThrow(/duration/);
    expect(() => validateTutorialToasts([{ id: 't', kind: 'info', duration: 3000, delay: 0, priority: 1, text: 'x' }], steps)).toThrow(/step/);
  });

  test('a toast is due the moment its conditions come true, once; a game opened with it already true does not repeat it', async () => {
    const { advance, state } = service({ buildings: [building('House-Mayor')] });
    expect((await advance.execute()).toasts).toEqual([]);

    state.buildings = [building('House-Mayor'), building('Market-Stall-Red', { workerNeed: 2, workers: 2 })];
    const due = (await advance.execute()).toasts;
    expect(due).toEqual([{ id: 'market-staffed', kind: 'success', duration: 5000, priority: 1, highlight: null, text: '« Marché » est pourvu !' }]);
    expect((await advance.execute()).toasts).toEqual([]);

    const reopened = service({ buildings: [building('Market-Stall-Red', { workerNeed: 2, workers: 2 })] });
    expect((await reopened.advance.execute()).toasts).toEqual([]);
  });
});
