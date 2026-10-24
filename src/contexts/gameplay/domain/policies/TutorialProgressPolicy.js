import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { isRoadType } from '../../../../shared/building-catalog/roadQueries.js';
import { getAnnualHarvestSchedule, getAnnualSupplyEntry, getPerCapitaDemand } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getSkillDisplay } from '../../../../shared/population/skillCatalog.js';
import { SOCIAL_CATEGORY } from '../../../../shared/population/socialCategoryCatalog.js';
import { MONTHS, MONTHS_PER_YEAR, SEASONS } from '../../../../shared/time/TimeCalendar.js';

/**
 * What the tutorial reads of the city, handed over by the composition root (see TutorialFactsPort.js). `calendar` is the game's clock read as the
 * player knows it: the turn, its season and month, and whether the annual harvest is on (the catalog's harvest schedule, matched by the root).
 * @typedef {{
 *   buildings: Array<{ type: string, pop: number, workers: number, workerNeed: number }>,
 *   calendar?: { turn: number, season: string, month: string, harvesting: boolean, monthsToHarvest: number | null },
 * }} TutorialFacts
 *
 * A condition is one entry `{ <kind>: <argument> }`; the kinds are the keys of CONDITION_KINDS. A step is done when all its conditions hold.
 * @typedef {Record<string, unknown>} TutorialCondition
 *
 * `delay`: turns to wait, after the player reaches the step, before its dépêche is given (required, 0 = at once).
 * `counter`: `{ label, items: [{ type, atLeast }] }`, the progress the screen shows while the player is on the step ("2/3"): each item counts the buildings of its
 * type up to `atLeast` (a number, or a token text such as `{farms:…}`).
 * `allow`: the construction buttons (building ids) that work while the player is on the step; the other construction buttons are greyed out.
 * `reminder`: a toast that reminds the player what the step asks when they have not done it: after `after` turns on the step, then every `every` turns
 * (absent = once), staying `duration` ms; it goes away with the step.
 * @typedef {{ id: string, done: TutorialCondition[], allow: string[], delay: number, reminder?: { after: number, every?: number, duration: number, text: string }, news: null | { title: string, body: string, teaser: string, blocking: boolean, action?: { kind: 'buildTool', toolId: string } } }} TutorialStep
 *
 * A toast is a short, non-blocking message shown the moment its conditions come true (`when` all hold and none of `unless` does).
 * A toast's moment is on when its `when` conditions all hold, none of its `unless` does, and — if it names a `step` — the player has reached that step
 * (is on it or past it). At least one of `when` / `step` is required. `delay`: turns the moment must last before the toast shows (required, 0 = at once).
 * `duration`: milliseconds it stays on screen, unless taken off earlier: when its moment goes off, or as soon as its `until` conditions hold (the player did
 * what it points at). `highlight`: a part of the interface it points at while it shows ('construction': the house-shaped button that opens the build bar).
 * @typedef {{ id: string, kind: 'info' | 'success' | 'warning', duration: number, when?: TutorialCondition[], unless?: TutorialCondition[], step?: string, delay: number, priority: number, until?: TutorialCondition[], highlight?: 'construction' | 'road' | 'history', text: string }} TutorialToast
 *
 * A dispatch is a dépêche triggered like a toast (same `when` / `unless` / `step` / `delay`), outside the sequence of steps: it comes when its moment
 * comes, whichever step the player is on. Announced once (Intelligence's once-only rule).
 * `unlocks`: construction buttons (building ids) that work from the moment the dépêche has been written, on top of the step's `allow`.
 * @typedef {{ id: string, when?: TutorialCondition[], unless?: TutorialCondition[], step?: string, delay: number, unlocks?: string[], news: { title: string, body: string, teaser: string, blocking: boolean, action?: { kind: 'buildTool', toolId: string }, illustrations?: string[], image?: { src: string, alt: string }, choices?: Array<{ label: string, page: object }>, next?: object } }} TutorialDispatch
 */

function requireBuildingId(kind, argument) {
  if (typeof argument !== 'string' || !getBuildingDefinition(argument)) {
    throw new Error(`[tutorial] the condition "${kind}" names "${String(argument)}", which is not a building of the catalog`);
  }
}

/**
 * The argument of a counting condition: a building id (at least one) or `{ type, atLeast }`.
 * @returns {{ type: string, atLeast: number }}
 */
function countedBuilding(kind, argument) {
  if (typeof argument === 'string') return { type: argument, atLeast: 1 };
  if (argument && typeof argument.type === 'string' && Number.isInteger(argument.atLeast) && argument.atLeast >= 1) {
    return { type: argument.type, atLeast: argument.atLeast };
  }
  throw new Error(`[tutorial] the condition "${kind}" takes a building id or { type, atLeast }, got ${JSON.stringify(argument)}`);
}

function validateCounted(kind) {
  return (argument) => requireBuildingId(kind, countedBuilding(kind, argument).type);
}

const ofType = (facts, type) => facts.buildings.filter((building) => building.type === type);
const isStaffed = (building) => building.workerNeed > 0 && building.workers >= building.workerNeed;

/**
 * What a house of that type eats over a year when it is full, in units of the catalog: its first tier's population (houses start there) times a
 * citizen's monthly need, over the year. 0 for a building that is not a house.
 */
function annualFoodNeedOfHouse(type) {
  const group = getBuildingDefinition(type)?.residentialGroup;
  if (!group) return 0;
  const tier = SOCIAL_CATEGORY[group]?.tiers?.[1];
  if (!tier) throw new Error(`[tutorial] the house "${type}" belongs to the group "${group}", which has no first tier in the social categories`);
  const perCitizen = getPerCapitaDemand(type);
  if (perCitizen <= 0) throw new Error(`[tutorial] the house "${type}" declares no food need in the catalog`);
  return tier.maxPopulation * perCitizen * MONTHS_PER_YEAR;
}

/** What a field of that type harvests in a year, from the catalog; 0 for a building that is not one. */
const annualFoodYieldOfField = (type) => getAnnualSupplyEntry(type)?.amount ?? 0;

function calendarOf(facts) {
  if (!facts.calendar) throw new Error('[tutorial] the facts hold no `calendar`, which a calendar condition needs');
  return facts.calendar;
}

function validateCalendarName(kind, names) {
  return (argument) => {
    if (!names.includes(argument)) throw new Error(`[tutorial] the condition "${kind}" takes one of ${names.join(', ')}, got ${JSON.stringify(argument)}`);
  };
}

/**
 * The only code the tutorial grows by: one entry per kind of condition a step or a toast can use. `validate` rejects a bad argument when the catalog
 * is checked; `test` reads the facts.
 */
const CONDITION_KINDS = Object.freeze({
  // At least N buildings of that type stand (N = 1 for a bare id).
  built: Object.freeze({
    validate: validateCounted('built'),
    test: (argument, facts) => {
      const { type, atLeast } = countedBuilding('built', argument);
      return ofType(facts, type).length >= atLeast;
    },
  }),
  // At least one road stands, whichever its variant.
  roadBuilt: Object.freeze({
    validate: (argument) => {
      if (argument !== true) throw new Error('[tutorial] the condition "roadBuilt" takes `true`');
    },
    test: (_argument, facts) => facts.buildings.some((building) => isRoadType(building.type)),
  }),
  // At least N houses of that type have residents.
  housed: Object.freeze({
    validate: validateCounted('housed'),
    test: (argument, facts) => {
      const { type, atLeast } = countedBuilding('housed', argument);
      return ofType(facts, type).filter((building) => building.pop > 0).length >= atLeast;
    },
  }),
  // At least N buildings of that type have all the workers they need.
  staffed: Object.freeze({
    validate: validateCounted('staffed'),
    test: (argument, facts) => {
      const { type, atLeast } = countedBuilding('staffed', argument);
      return ofType(facts, type).filter(isStaffed).length >= atLeast;
    },
  }),
  // At least one building of those types shows the no-work sprite: it needs workers and has none (the rule of the city's `understaffedBuildingIds`,
  // computeCityEmploymentSummary.js). A list of building ids, or 'any' for a building of any type.
  noWork: Object.freeze({
    validate: (argument) => {
      if (argument === 'any') return;
      if (!Array.isArray(argument) || argument.length === 0) throw new Error(`[tutorial] the condition "noWork" takes 'any' or a list of building ids, got ${JSON.stringify(argument)}`);
      argument.forEach((type) => requireBuildingId('noWork', type));
    },
    test: (argument, facts) => facts.buildings.some((building) => (argument === 'any' || argument.includes(building.type)) && building.workerNeed > 0 && building.workers === 0),
  }),
  // The fields feed every house placed: their yearly harvest covers what the houses eat when full. 'built' counts every field standing, 'staffed'
  // only those with their workers. The number of fields it takes comes from the catalog (a field's yield, a citizen's need, a house's capacity).
  foodCovered: Object.freeze({
    validate: (argument) => {
      if (argument !== 'built' && argument !== 'staffed') throw new Error(`[tutorial] the condition "foodCovered" takes 'built' or 'staffed', got ${JSON.stringify(argument)}`);
    },
    test: (argument, facts) => {
      const need = facts.buildings.reduce((sum, building) => sum + annualFoodNeedOfHouse(building.type), 0);
      const fields = argument === 'staffed' ? facts.buildings.filter(isStaffed) : facts.buildings;
      const harvest = fields.reduce((sum, building) => sum + annualFoodYieldOfField(building.type), 0);
      return need > 0 && harvest >= need;
    },
  }),
  // The game's turn has reached N (the tutorial starts at turn 0).
  turnAtLeast: Object.freeze({
    validate: (argument) => {
      if (!Number.isInteger(argument) || argument < 0) throw new Error(`[tutorial] the condition "turnAtLeast" takes a turn (0 or more), got ${JSON.stringify(argument)}`);
    },
    test: (argument, facts) => calendarOf(facts).turn >= argument,
  }),
  // The game is in that season / month (names of the calendar).
  season: Object.freeze({
    validate: validateCalendarName('season', SEASONS),
    test: (argument, facts) => calendarOf(facts).season === argument,
  }),
  month: Object.freeze({
    validate: validateCalendarName('month', MONTHS),
    test: (argument, facts) => calendarOf(facts).month === argument,
  }),
  // The harvest is at most N months away (0 = it is on now): the time left to have the fields grown.
  harvestWithin: Object.freeze({
    validate: (argument) => {
      if (!Number.isInteger(argument) || argument < 0) throw new Error(`[tutorial] the condition "harvestWithin" takes a number of months (0 or more), got ${JSON.stringify(argument)}`);
    },
    test: (argument, facts) => {
      const months = calendarOf(facts).monthsToHarvest;
      return Number.isInteger(months) && months <= argument;
    },
  }),
  // The annual harvest is on: the month the catalog's harvest schedule names.
  harvest: Object.freeze({
    validate: (argument) => {
      if (argument !== true) throw new Error('[tutorial] the condition "harvest" takes `true`');
    },
    test: (_argument, facts) => calendarOf(facts).harvesting === true,
  }),
});

function conditionOf(ownerId, condition) {
  const kinds = Object.keys(condition ?? {});
  if (kinds.length !== 1) {
    throw new Error(`[tutorial] "${ownerId}": a condition holds exactly one kind, got ${JSON.stringify(condition)}`);
  }
  const kind = kinds[0];
  const definition = CONDITION_KINDS[kind];
  if (!definition) {
    throw new Error(`[tutorial] "${ownerId}": "${kind}" is not a kind of condition (${Object.keys(CONDITION_KINDS).join(', ')})`);
  }
  return { definition, argument: condition[kind] };
}

function validateConditions(ownerId, conditions) {
  for (const condition of conditions) {
    const { definition, argument } = conditionOf(ownerId, condition);
    definition.validate(argument);
  }
}

/** `delay` is required (0 = at once): a whole number of turns, 0 or more. */
function validateDelay(ownerId, delay) {
  if (!Number.isInteger(delay) || delay < 0) {
    throw new Error(`[tutorial] "${ownerId}": \`delay\` is a whole number of turns (0 or more), got ${JSON.stringify(delay)}`);
  }
}

function factsOf(facts) {
  if (!Array.isArray(facts?.buildings)) {
    throw new Error('[tutorial] the facts hold no `buildings` list');
  }
  return facts;
}

/** Whether every condition holds (an empty list holds). */
function allHold(ownerId, conditions, facts) {
  return conditions.every((condition) => {
    const { definition, argument } = conditionOf(ownerId, condition);
    return definition.test(argument, factsOf(facts));
  });
}

const TOKEN = /\{([a-z]+):([^}]+)\}/g;

/** `{farms:3*House-Red/Farm-Wheat}`: how many fields of that type feed that many houses of that type, from the catalog (rounded up). */
function fieldsToFeed(argument) {
  const match = /^(\d+)\*([^/]+)\/(.+)$/.exec(argument);
  if (!match) throw new Error(`[tutorial] "{farms:${argument}}" must read {farms:<houses>*<house id>/<field id>}`);
  const [, houses, houseType, fieldType] = match;
  requireBuildingId('farms', houseType);
  const yearly = annualFoodYieldOfField(fieldType);
  if (yearly <= 0) throw new Error(`[tutorial] "{farms:${argument}}": "${fieldType}" is not a field that supplies food in the catalog`);
  const need = annualFoodNeedOfHouse(houseType);
  if (need <= 0) throw new Error(`[tutorial] "{farms:${argument}}": "${houseType}" is not a house with a food need`);
  return String(Math.ceil((Number(houses) * need) / yearly));
}

/** `{harvest:when}`: the season(s) or month(s) the catalog's harvest schedule names. */
function harvestWhen() {
  const schedule = getAnnualHarvestSchedule();
  if (!schedule || (schedule.unit !== 'season' && schedule.unit !== 'month') || !Array.isArray(schedule.values) || schedule.values.length === 0) {
    throw new Error(`[tutorial] "{harvest:when}": the catalog's harvest schedule must name seasons or months, got ${JSON.stringify(schedule)}`);
  }
  // A season or a month is written with a capital in the catalog; in the middle of a sentence it takes none ("en automne").
  return schedule.values.join(', ').toLowerCase();
}

/**
 * The words the catalog decides, put into a text: `{building:<id>}` is that building's name, `{skill:<id>}` that skill's label, `{skillicon:<id>}` its
 * emoji, `{harvest:when}` the harvest's season or month, `{farms:<n>*<house id>/<field id>}` the fields it takes to feed n such houses.
 * An id the catalogs do not know throws: no stand-in word.
 * @param {string} text
 * @returns {string}
 */
export function resolveTutorialText(text) {
  const resolved = text.replace(TOKEN, (_whole, kind, id) => {
    if (kind === 'farms') return fieldsToFeed(id);
    if (kind === 'harvest') {
      if (id !== 'when') throw new Error(`[tutorial] "{harvest:${id}}": only {harvest:when} exists`);
      return harvestWhen();
    }
    if (kind === 'skillicon') {
      const emoji = getSkillDisplay(id).emoji;
      if (emoji === '…') throw new Error(`[tutorial] "{skillicon:${id}}" is not a skill of the skill catalog`);
      return emoji;
    }
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
    throw new Error(`[tutorial] "{${kind}:${id}}": "${kind}" is not a kind of token (building, skill, skillicon, harvest, farms)`);
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
    validateConditions(step.id, step.done);
    validateDelay(step.id, step.delay);
    validateReminder(step.id, step.reminder);
    validateCounter(step.id, step.counter);
    // Every step names the construction buttons that work while the player is on it; the others are greyed out. Said, never left out.
    if (!Array.isArray(step.allow) || step.allow.length === 0) {
      throw new Error(`[tutorial] step "${step.id}" has no \`allow\`: the list of construction buttons that work on that step`);
    }
    step.allow.forEach((type) => requireBuildingId('allow', type));
    // `news: null` is a step that only waits (the game already guides that moment); it must be said, not left out.
    if (step.news === undefined) throw new Error(`[tutorial] step "${step.id}" has no \`news\` (null for a step that says nothing)`);
    if (step.news === null) continue;
    validateNews(step.id, step.news);
  }
}

/** A step's `reminder` (optional): the toast that reminds the player what the step asks, once `after` turns have passed on it, then every `every` turns. */
function validateReminder(ownerId, reminder) {
  if (reminder === undefined) return;
  const positive = (value) => Number.isInteger(value) && value >= 1;
  if (!positive(reminder.after) || (reminder.every !== undefined && !positive(reminder.every)) || !positive(reminder.duration)) {
    throw new Error(`[tutorial] "${ownerId}": \`reminder\` is { after, every?, duration, text } with whole numbers of turns / milliseconds (1 or more), got ${JSON.stringify(reminder)}`);
  }
  if (typeof reminder.text !== 'string' || reminder.text === '') throw new Error(`[tutorial] "${ownerId}": its reminder has no text`);
  resolveTutorialText(reminder.text);
}

/**
 * The toast of a step's reminder, its words resolved. Its id is `reminder:<step id>`.
 * @param {TutorialStep} step a step with a `reminder`
 * @returns {{ id: string, kind: 'warning', duration: number, priority: number, highlight: null, text: string }}
 */
export function tutorialReminderOf(step) {
  // A reminder is by nature an instruction: what the step asks, said again.
  return { id: `reminder:${step.id}`, kind: 'warning', duration: step.reminder.duration, priority: TOAST_PRIORITIES.instruction, highlight: null, text: resolveTutorialText(step.reminder.text) };
}

/** A dépêche's words, action and illustrations. */
function validateNews(ownerId, news) {
  for (const field of ['title', 'teaser']) {
    if (typeof news[field] !== 'string' || news[field] === '') {
      throw new Error(`[tutorial] "${ownerId}": its news has no ${field}`);
    }
    resolveTutorialText(news[field]);
  }
  validatePage(ownerId, news);
  // A blocking dépêche cannot be closed: the only way out is its button, so it must have one.
  if (typeof news.blocking !== 'boolean') throw new Error(`[tutorial] "${ownerId}": \`blocking\` is \`true\` or \`false\`, said on every dépêche, got ${JSON.stringify(news.blocking)}`);
  if (news.blocking && !news.action) throw new Error(`[tutorial] "${ownerId}": a blocking dépêche needs an \`action\` (its only way out)`);
}

/**
 * A page of a dépêche (the dépêche itself is its first page): its text, and what it offers — an action, a picture, `choices` (buttons, each with a
 * sentence of the catalog and the page it opens) and `next` (the page "Lire la suite" opens).
 */
function validatePage(ownerId, page) {
  if (typeof page.body !== 'string' || page.body === '') throw new Error(`[tutorial] "${ownerId}": a page of its news has no body`);
  resolveTutorialText(page.body);
  if (page.choices !== undefined) {
    if (!Array.isArray(page.choices) || page.choices.length === 0) throw new Error(`[tutorial] "${ownerId}": \`choices\` is a list of { label, page }`);
    for (const choice of page.choices) {
      if (typeof choice?.label !== 'string' || choice.label === '' || !choice.page) {
        throw new Error(`[tutorial] "${ownerId}": a choice is { label, page }, got ${JSON.stringify(choice)}`);
      }
      resolveTutorialText(choice.label);
      validatePage(ownerId, choice.page);
    }
  }
  if (page.next !== undefined) validatePage(ownerId, page.next);
  validatePageContent(ownerId, page);
}

function validatePageContent(ownerId, news) {
  if (news.action) {
    if (news.action.kind !== 'buildTool') {
      throw new Error(`[tutorial] "${ownerId}": "${news.action.kind}" is not a kind of action (buildTool)`);
    }
    requireBuildingId('buildTool', news.action.toolId);
  }
  if (news.illustrations !== undefined) {
    if (!Array.isArray(news.illustrations) || news.illustrations.length === 0) {
      throw new Error(`[tutorial] "${ownerId}": \`illustrations\` is a list of building ids`);
    }
    news.illustrations.forEach((buildingId) => requireBuildingId('illustrations', buildingId));
  }
  if (news.legend !== undefined) {
    if (!Array.isArray(news.legend) || news.legend.length === 0) throw new Error(`[tutorial] "${ownerId}": \`legend\` is a list of { icon, word }`);
    for (const entry of news.legend) {
      if (typeof entry?.icon !== 'string' || entry.icon === '' || typeof entry.word !== 'string' || entry.word === '') {
        throw new Error(`[tutorial] "${ownerId}": a legend entry is { icon, word }, got ${JSON.stringify(entry)}`);
      }
      resolveTutorialText(entry.word);
    }
  }
  if (news.image !== undefined) {
    if (typeof news.image?.src !== 'string' || !news.image.src.startsWith('/') || typeof news.image.alt !== 'string' || news.image.alt === '') {
      throw new Error(`[tutorial] "${ownerId}": \`image\` is { src: '/path/in/public.png', alt: '…' }, got ${JSON.stringify(news.image)}`);
    }
  }
}

/** What decides when a toast or a dispatch is on: `when` / `unless` conditions, the `step` reached, and the `delay`. At least one of `when` / `step`. */
function validateMoment(ownerId, moment, steps) {
  if (moment.when === undefined && moment.step === undefined) throw new Error(`[tutorial] "${ownerId}" has no \`when\` and no \`step\` to trigger it`);
  if (moment.when !== undefined) {
    if (!Array.isArray(moment.when) || moment.when.length === 0) throw new Error(`[tutorial] "${ownerId}": \`when\` is a list of conditions`);
    validateConditions(ownerId, moment.when);
  }
  if (moment.step !== undefined && !steps.some((step) => step.id === moment.step)) {
    throw new Error(`[tutorial] "${ownerId}" names the step "${String(moment.step)}", which is not in the script`);
  }
  if (moment.unless !== undefined) {
    if (!Array.isArray(moment.unless)) throw new Error(`[tutorial] "${ownerId}": \`unless\` is a list of conditions`);
    validateConditions(ownerId, moment.unless);
  }
  validateDelay(ownerId, moment.delay);
}

/**
 * Checks the dispatches (dépêches triggered like toasts, outside the sequence of steps): ids, trigger, and the dépêche itself.
 * @param {ReadonlyArray<TutorialDispatch>} dispatches
 * @param {ReadonlyArray<TutorialStep>} steps
 */
export function validateTutorialDispatches(dispatches, steps) {
  if (!Array.isArray(dispatches)) throw new Error('[tutorial] the dispatches are not a list');
  const seen = new Set();
  for (const dispatch of dispatches) {
    if (typeof dispatch?.id !== 'string' || dispatch.id === '') throw new Error('[tutorial] a dispatch has no id');
    if (seen.has(dispatch.id) || steps.some((step) => step.id === dispatch.id)) throw new Error(`[tutorial] the id "${dispatch.id}" is used twice (steps and dispatches share the once-only ids)`);
    seen.add(dispatch.id);
    validateMoment(dispatch.id, dispatch, steps);
    if (dispatch.unlocks !== undefined) {
      if (!Array.isArray(dispatch.unlocks) || dispatch.unlocks.length === 0) throw new Error(`[tutorial] dispatch "${dispatch.id}": \`unlocks\` is a list of building ids`);
      dispatch.unlocks.forEach((type) => requireBuildingId('unlocks', type));
    }
    if (!dispatch.news) throw new Error(`[tutorial] dispatch "${dispatch.id}" has no \`news\``);
    validateNews(dispatch.id, dispatch.news);
  }
}

const HIGHLIGHT_TARGETS = Object.freeze(['construction', 'road', 'history']);

const TOAST_KINDS = Object.freeze(['info', 'success', 'warning']);

/**
 * How much a toast matters when several are due at once and the screen holds only a few (the higher shows first, the others wait their turn):
 * `instruction` points the player at something to do (a button to press, the reminder of a step), `lack` says a building is still missing something,
 * `news` is everything else (a congratulation, an arrival).
 */
export const TOAST_PRIORITIES = Object.freeze({ news: 1, lack: 2, instruction: 3 });

/**
 * Checks the toasts like the steps: ids, conditions, kind and words.
 * @param {ReadonlyArray<TutorialToast>} toasts
 * @param {ReadonlyArray<TutorialStep>} steps the script, for the steps a toast names
 */
export function validateTutorialToasts(toasts, steps) {
  if (!Array.isArray(toasts)) throw new Error('[tutorial] the toasts are not a list');
  const seen = new Set();
  for (const toast of toasts) {
    if (typeof toast?.id !== 'string' || toast.id === '') throw new Error('[tutorial] a toast has no id');
    if (seen.has(toast.id)) throw new Error(`[tutorial] the toast id "${toast.id}" is used twice`);
    seen.add(toast.id);
    if (!TOAST_KINDS.includes(toast.kind)) throw new Error(`[tutorial] toast "${toast.id}": "${toast.kind}" is not a kind of toast (${TOAST_KINDS.join(', ')})`);
    if (!Number.isInteger(toast.duration) || toast.duration <= 0) {
      throw new Error(`[tutorial] toast "${toast.id}": \`duration\` is a number of milliseconds (more than 0), got ${JSON.stringify(toast.duration)}`);
    }
    // Said on every toast, never assumed: it decides which toast the screen shows first when several are due (see TOAST_PRIORITIES).
    if (!Object.values(TOAST_PRIORITIES).includes(toast.priority)) {
      throw new Error(`[tutorial] toast "${toast.id}": \`priority\` is one of ${Object.values(TOAST_PRIORITIES).join(', ')}, got ${JSON.stringify(toast.priority)}`);
    }
    validateMoment(toast.id, toast, steps);
    if (toast.until !== undefined) {
      if (!Array.isArray(toast.until) || toast.until.length === 0) throw new Error(`[tutorial] toast "${toast.id}": \`until\` is a list of conditions`);
      validateConditions(toast.id, toast.until);
    }
    if (toast.highlight !== undefined && !HIGHLIGHT_TARGETS.includes(toast.highlight)) {
      throw new Error(`[tutorial] toast "${toast.id}": \`highlight\` points at one of ${HIGHLIGHT_TARGETS.join(', ')}, got ${JSON.stringify(toast.highlight)}`);
    }
    if (typeof toast.text !== 'string' || toast.text === '') throw new Error(`[tutorial] toast "${toast.id}" has no text`);
    resolveTutorialText(toast.text);
  }
}

/**
 * @param {TutorialStep} step
 * @param {TutorialFacts} facts
 * @returns {boolean}
 */
export function isTutorialStepDone(step, facts) {
  return allHold(step.id, step.done, facts);
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

/** A counter item's target: a whole number, or a token text that resolves to one (`{farms:…}`). */
function counterTargetOf(atLeast) {
  const target = typeof atLeast === 'number' ? atLeast : Number(resolveTutorialText(atLeast));
  if (!Number.isInteger(target) || target < 1) throw new Error(`[tutorial] a counter target is a whole number of 1 or more, got ${JSON.stringify(atLeast)} (${target})`);
  return target;
}

function validateCounter(ownerId, counter) {
  if (counter === undefined) return;
  if (typeof counter.label !== 'string' || counter.label === '') throw new Error(`[tutorial] "${ownerId}": its counter has no label`);
  resolveTutorialText(counter.label);
  // `after` is said on every counter: null shows it at once (the shape of what it names is checked by AdvanceTutorial, which knows the dépêches and toasts).
  if (counter.after === undefined) throw new Error(`[tutorial] "${ownerId}": its counter has no \`after\` (null to show at once)`);
  if (!Array.isArray(counter.items) || counter.items.length === 0) throw new Error(`[tutorial] "${ownerId}": its counter \`items\` is a list of { type, atLeast }`);
  for (const item of counter.items) {
    requireBuildingId('counter', item?.type);
    counterTargetOf(item.atLeast);
  }
}

/**
 * What the player has done towards the step's objective, for the counter the screen shows ("2/3"): each item counts the buildings of its type up to
 * its target. Null for a step with no counter.
 * @param {TutorialStep} step
 * @param {TutorialFacts} facts
 * @returns {{ label: string, have: number, target: number } | null}
 */
export function counterOf(step, facts) {
  if (!step.counter) return null;
  let have = 0;
  let target = 0;
  for (const item of step.counter.items) {
    const atLeast = counterTargetOf(item.atLeast);
    have += Math.min(ofType(factsOf(facts), item.type).length, atLeast);
    target += atLeast;
  }
  return { label: resolveTutorialText(step.counter.label), have, target };
}

/**
 * The construction buttons that work on the step the player is on; null once the script is over (nothing is greyed out any more).
 * @param {ReadonlyArray<TutorialStep>} steps
 * @param {TutorialFacts} facts
 * @returns {string[] | null}
 */
export function allowedToolsOf(steps, facts) {
  return currentTutorialStep(steps, facts)?.allow ?? null;
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
    teaser: resolveTutorialText(step.news.teaser),
    blocking: step.news.blocking,
    ...pageDraftOf(step.news),
  };
}

/** A page with its words resolved: `{ body, action, illustrations, image, choices: [{ label, page }], next }` (empty / null when it has none). */
function pageDraftOf(page) {
  return {
    body: resolveTutorialText(page.body),
    action: page.action ?? null,
    illustrations: page.illustrations ?? [],
    image: page.image ?? null,
    legend: page.legend ?? [],
    choices: (page.choices ?? []).map((choice) => ({ label: resolveTutorialText(choice.label), page: pageDraftOf(choice.page) })),
    next: page.next ? pageDraftOf(page.next) : null,
  };
}

/**
 * Whether a toast's moment is on: the player has reached its `step` (if it names one), its `when` all hold and none of its `unless` does.
 * @param {TutorialToast} toast
 * @param {TutorialFacts} facts
 * @param {ReadonlyArray<TutorialStep>} steps
 * @returns {boolean}
 */
export function isTutorialMomentOn(toast, facts, steps) {
  if (toast.step !== undefined) {
    const current = currentTutorialStep(steps, facts);
    const reached = current === null || steps.findIndex((step) => step.id === current.id) >= steps.findIndex((step) => step.id === toast.step);
    if (!reached) return false;
  }
  return allHold(toast.id, toast.when ?? [], facts) && !(toast.unless ?? []).some((condition) => allHold(toast.id, [condition], facts));
}

/**
 * Whether the player has done what the toast points at: its `until` conditions all hold (a toast without `until` is never closed this way).
 * @param {TutorialToast} toast
 * @param {TutorialFacts} facts
 * @returns {boolean}
 */
export function isTutorialToastDone(toast, facts) {
  return toast.until !== undefined && allHold(toast.id, toast.until, facts);
}

/**
 * The toast as the player reads it, its words resolved from the catalogs.
 * @param {TutorialToast} toast
 * @returns {{ id: string, kind: 'info' | 'success' | 'warning', duration: number, priority: number, highlight: string | null, text: string }}
 */
export function tutorialToastOf(toast) {
  return { id: toast.id, kind: toast.kind, duration: toast.duration, priority: toast.priority, highlight: toast.highlight ?? null, text: resolveTutorialText(toast.text) };
}
