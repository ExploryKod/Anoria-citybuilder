import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { isRoadType } from '../../../../shared/building-catalog/roadQueries.js';
import { getSkillDisplay } from '../../../../shared/population/skillCatalog.js';

/**
 * What the tutorial reads of the city, handed over by the composition root (see TutorialFactsPort.js).
 * @typedef {{ buildings: Array<{ type: string, pop: number, workers: number, workerNeed: number }> }} TutorialFacts
 *
 * A condition is one entry `{ <kind>: <argument> }`; the kinds are the keys of CONDITION_KINDS. A step is done when all its conditions hold.
 * @typedef {Record<string, unknown>} TutorialCondition
 *
 * @typedef {{ id: string, done: TutorialCondition[], news: null | { title: string, body: string, teaser: string, action?: { kind: 'buildTool', toolId: string } } }} TutorialStep
 */

function requireBuildingId(kind, argument) {
  if (typeof argument !== 'string' || !getBuildingDefinition(argument)) {
    throw new Error(`[tutorial] the condition "${kind}" names "${String(argument)}", which is not a building of the catalog`);
  }
}

const ofType = (facts, type) => facts.buildings.filter((building) => building.type === type);

/**
 * The only code the tutorial grows by: one entry per kind of condition a step can use. `validate` rejects a bad argument when the catalog
 * is checked; `test` reads the facts.
 */
const CONDITION_KINDS = Object.freeze({
  // At least one building of that type stands.
  built: Object.freeze({
    validate: (argument) => requireBuildingId('built', argument),
    test: (argument, facts) => ofType(facts, argument).length > 0,
  }),
  // At least one road stands, whichever its variant.
  roadBuilt: Object.freeze({
    validate: (argument) => {
      if (argument !== true) throw new Error('[tutorial] the condition "roadBuilt" takes `true`');
    },
    test: (_argument, facts) => facts.buildings.some((building) => isRoadType(building.type)),
  }),
  // A house of that type has residents.
  housed: Object.freeze({
    validate: (argument) => requireBuildingId('housed', argument),
    test: (argument, facts) => ofType(facts, argument).some((building) => building.pop > 0),
  }),
  // A building of that type has all the workers it needs.
  staffed: Object.freeze({
    validate: (argument) => requireBuildingId('staffed', argument),
    test: (argument, facts) => ofType(facts, argument).some((building) => building.workerNeed > 0 && building.workers >= building.workerNeed),
  }),
});

function conditionOf(stepId, condition) {
  const kinds = Object.keys(condition ?? {});
  if (kinds.length !== 1) {
    throw new Error(`[tutorial] step "${stepId}": a condition holds exactly one kind, got ${JSON.stringify(condition)}`);
  }
  const kind = kinds[0];
  const definition = CONDITION_KINDS[kind];
  if (!definition) {
    throw new Error(`[tutorial] step "${stepId}": "${kind}" is not a kind of condition (${Object.keys(CONDITION_KINDS).join(', ')})`);
  }
  return { definition, argument: condition[kind] };
}

const TOKEN = /\{([a-z]+):([^}]+)\}/g;

/**
 * The words the catalog decides, put into a step's text: `{building:<id>}` is that building's name, `{skill:<id>}` that skill's label.
 * An id the catalogs do not know throws: no stand-in word.
 * @param {string} text
 * @returns {string}
 */
export function resolveTutorialText(text) {
  const resolved = text.replace(TOKEN, (_whole, kind, id) => {
    if (kind === 'building') {
      const name = getBuildingDefinition(id)?.displayName;
      if (!name) throw new Error(`[tutorial] "{building:${id}}" is not a building of the catalog with a displayName`);
      return name;
    }
    if (kind === 'skill') {
      const label = getSkillDisplay(id).label;
      // The skill vocabulary answers "…" for a skill it does not know.
      if (label === '…') throw new Error(`[tutorial] "{skill:${id}}" is not a skill of the skill catalog`);
      return label;
    }
    throw new Error(`[tutorial] "{${kind}:${id}}": "${kind}" is not a kind of token (building, skill)`);
  });
  if (/[{}]/.test(resolved)) {
    throw new Error(`[tutorial] the text keeps a brace after its tokens were resolved: ${text}`);
  }
  return resolved;
}

/**
 * Checks the whole script once, when the game's contexts are built, so a mistake in the catalog shows at boot and names its step.
 * @param {ReadonlyArray<TutorialStep>} steps
 */
export function validateTutorialSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('[tutorial] the catalog holds no step');
  }
  const seen = new Set();
  for (const step of steps) {
    if (typeof step?.id !== 'string' || step.id === '') throw new Error('[tutorial] a step has no id');
    if (seen.has(step.id)) throw new Error(`[tutorial] the step id "${step.id}" is used twice`);
    seen.add(step.id);
    if (!Array.isArray(step.done) || step.done.length === 0) {
      throw new Error(`[tutorial] step "${step.id}" has no condition to be done`);
    }
    for (const condition of step.done) {
      const { definition, argument } = conditionOf(step.id, condition);
      definition.validate(argument);
    }
    // `news: null` is a step that only waits (the game already guides that moment); it must be said, not left out.
    if (step.news === undefined) throw new Error(`[tutorial] step "${step.id}" has no \`news\` (null for a step that says nothing)`);
    if (step.news === null) continue;
    for (const field of ['title', 'body', 'teaser']) {
      if (typeof step.news[field] !== 'string' || step.news[field] === '') {
        throw new Error(`[tutorial] step "${step.id}": its news has no ${field}`);
      }
      resolveTutorialText(step.news[field]);
    }
    if (step.news.action) {
      if (step.news.action.kind !== 'buildTool') {
        throw new Error(`[tutorial] step "${step.id}": "${step.news.action.kind}" is not a kind of action (buildTool)`);
      }
      requireBuildingId('buildTool', step.news.action.toolId);
    }
  }
}

/**
 * @param {TutorialStep} step
 * @param {TutorialFacts} facts
 * @returns {boolean}
 */
export function isTutorialStepDone(step, facts) {
  if (!Array.isArray(facts?.buildings)) {
    throw new Error('[tutorial] the facts hold no `buildings` list');
  }
  return step.done.every((condition) => {
    const { definition, argument } = conditionOf(step.id, condition);
    return definition.test(argument, facts);
  });
}

/**
 * The step the player is on: the first one not done, in the catalog's order. Null once the whole script is done. Progress is derived from the
 * facts each time, never stored.
 * @param {ReadonlyArray<TutorialStep>} steps
 * @param {TutorialFacts} facts
 * @returns {TutorialStep | null}
 */
export function currentTutorialStep(steps, facts) {
  return steps.find((step) => !isTutorialStepDone(step, facts)) ?? null;
}

/**
 * The dépêche of a step, its words resolved from the catalogs.
 * @param {TutorialStep} step a step with `news`
 * @returns {{ title: string, body: string, teaser: string, action: { kind: 'buildTool', toolId: string } | null }}
 */
export function tutorialDraftOf(step) {
  if (!step.news) throw new Error(`[tutorial] step "${step.id}" says nothing: it has no dépêche to draft`);
  return {
    title: resolveTutorialText(step.news.title),
    body: resolveTutorialText(step.news.body),
    teaser: resolveTutorialText(step.news.teaser),
    action: step.news.action ?? null,
  };
}
