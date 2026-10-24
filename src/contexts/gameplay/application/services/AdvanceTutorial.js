import {
  allowedToolsOf,
  counterOf,
  currentTutorialStep,
  isTutorialMomentOn,
  isTutorialToastDone,
  tutorialDraftOf,
  tutorialReminderOf,
  tutorialToastOf,
  validateTutorialDispatches,
  validateTutorialSteps,
  validateTutorialToasts,
} from '../../domain/policies/TutorialProgressPolicy.js';

/**
 * Moves the tutorial on: reads the city's facts, gives the instruction of the step the player is on as a dépêche, gives the dispatches whose moment
 * has come, and says which toasts are due. Called after a placement and at the end of a turn. The step is derived from the facts (the once-only
 * announcement of a dépêche belongs to the news), so calling it often is harmless.
 *
 * It remembers two things, only for the session: which toast moments were on at the last look (a toast is due when its moment comes, after its
 * `delay`; the first look only records, so a game reopened mid-tutorial does not repeat what was already true), and since which turn the player is on
 * the current step or a dispatch's moment has lasted (for the `delay` of a step's dépêche and of a dispatch). Nothing is stored.
 */
export class AdvanceTutorial {
  /**
   * @param {object} deps
   * @param {ReadonlyArray<import('../../domain/policies/TutorialProgressPolicy.js').TutorialStep>} deps.steps
   * @param {ReadonlyArray<import('../../domain/policies/TutorialProgressPolicy.js').TutorialDispatch>} deps.dispatches
   * @param {ReadonlyArray<import('../../domain/policies/TutorialProgressPolicy.js').TutorialToast>} deps.toasts
   * @param {() => boolean} deps.isActive whether this game runs the tutorial (the composition root decides; the domain reads no session)
   * @param {import('../ports/TutorialFactsPort.js').TutorialFactsPort} deps.facts
   * @param {import('../ports/TutorialAnnouncerPort.js').TutorialAnnouncerPort} deps.announcer
   * @param {() => number} deps.getGameTime
   */
  constructor({ steps, dispatches, toasts, isActive, facts, announcer, getGameTime }) {
    validateTutorialSteps(steps);
    validateTutorialDispatches(dispatches, steps);
    validateTutorialToasts(toasts, steps);
    for (const step of steps) {
      if (!step.counter || step.counter.after === null) continue;
      const after = step.counter.after;
      const kinds = Object.keys(after);
      if (kinds.length !== 1 || !['news', 'toast', 'event'].includes(kinds[0])) {
        throw new Error(`[tutorial] "${step.id}": its counter \`after\` is exactly one of { news }, { toast } or { event }, got ${JSON.stringify(after)}`);
      }
      if (after.news !== undefined && !dispatches.some((dispatch) => dispatch.id === after.news) && !steps.some((other) => other.id === after.news && other.news)) {
        throw new Error(`[tutorial] "${step.id}": its counter \`after\` names the dépêche "${after.news}", which does not exist`);
      }
      if (after.toast !== undefined && !toasts.some((toast) => toast.id === after.toast)) {
        throw new Error(`[tutorial] "${step.id}": its counter \`after\` names the toast "${after.toast}", which does not exist`);
      }
      if (after.event !== undefined && (!Array.isArray(after.event) || after.event.length === 0)) {
        throw new Error(`[tutorial] "${step.id}": its counter \`after.event\` is a list of conditions, read like a toast's \`when\``);
      }
    }
    this.steps = steps;
    this.dispatches = dispatches;
    this.toasts = toasts;
    this.isActive = isActive;
    this.facts = facts;
    this.announcer = announcer;
    this.getGameTime = getGameTime;
    /** @type {Map<string, { since: number | null, shown: boolean }> | null} per toast: the turn its moment began (null when off) and whether it was shown; null before the first look */
    this.toastsState = null;
    /** @type {Map<string, number>} per dispatch whose moment is on: the turn it began */
    this.dispatchesSince = new Map();
    /** @type {{ stepId: string, since: number } | null} the step being waited on and the turn the player reached it */
    this.stepSince = null;
    /** @type {{ turn: number } | null} when the reminder of the current step was last given */
    this.reminded = null;
  }

  /**
   * @returns {Promise<{
   *   news: object | null,
   *   toasts: Array<{ id: string, kind: 'info' | 'success' | 'warning', duration: number, highlight: string | null, text: string }>,
   *   dismissed: string[],
   *   allowed: string[] | null,
   *   progress: { label: string, have: number, target: number } | null,
   *   justCompleted: { label: string, have: number, target: number } | null,
   * }>} `news`: the last dépêche just written (null when not a tutorial game, nothing is due, it was announced before, or the script is over);
   *   `toasts`: the toasts whose moment has just come, to show without blocking; `dismissed`: ids of shown toasts to take off the screen now (the
   *   player did what they point at, or their moment is over); `allowed`: the construction buttons that work on the current step (the others are greyed
   *   out), null when nothing is restricted (not a tutorial game, or the script is over);
   *   `progress`: the counter of the current step ("2/3"; null when it has none, or while the player has not yet got past the
   *   step's dépêche); `justCompleted`: the counter of the step the player has just finished
   *   (full), so the screen can show it done before moving to the next
   */
  async execute() {
    if (!this.isActive()) return { news: null, toasts: [], dismissed: [], allowed: null, progress: null, justCompleted: null };
    const facts = await this.facts.read();
    const turn = this.getGameTime();
    const { due: toasts, dismissed } = this.#toastsDue(facts, turn);
    let news = null;

    const step = currentTutorialStep(this.steps, facts);
    let justCompleted = null;
    if (step?.id !== this.stepSince?.stepId) {
      // The player moved on: the reminder of the step they left goes away with it, and its counter is shown full for a moment.
      const left = this.stepSince ? this.steps.find((candidate) => candidate.id === this.stepSince.stepId) : null;
      if (left) justCompleted = counterOf(left, facts);
      if (this.reminded) dismissed.push(`reminder:${this.stepSince.stepId}`);
      this.reminded = null;
      this.stepSince = step ? { stepId: step.id, since: turn } : null;
    }
    const reminder = this.#reminderDue(step, turn);
    if (reminder) toasts.push(reminder);
    if (step?.news && turn - this.stepSince.since >= step.delay) {
      news = await this.announcer.announce({ stepId: step.id, turn, ...tutorialDraftOf(step) });
    }

    for (const dispatch of this.#dispatchesDue(facts, turn)) {
      news = (await this.announcer.announce({ stepId: dispatch.id, turn, ...tutorialDraftOf(dispatch) })) ?? news;
    }
    return {
      news,
      toasts,
      dismissed,
      allowed: await this.#allowedTools(facts),
      progress: await this.#progressOf(step, facts),
      justCompleted,
    };
  }

  /** The step's counter, once its explanation has been got past (a step with no dépêche shows it at once); null before, and for a step with no counter. */
  async #progressOf(step, facts) {
    if (!step?.counter) return null;
    if (step.news && !(await this.announcer.wasRead(step.id))) return null;
    if (!(await this.#counterAfterHolds(step, facts))) return null;
    return counterOf(step, facts);
  }

  /** The counter's `after`, when it has one: a dépêche closed (`news`), a toast shown (`toast`), or an event whose conditions hold (`event`). */
  async #counterAfterHolds(step, facts) {
    const after = step.counter.after;
    if (after === null) return true;
    if (after.news !== undefined) return this.announcer.wasRead(after.news);
    if (after.toast !== undefined) return this.toastsState?.get(after.toast)?.shown === true;
    return isTutorialMomentOn({ id: `counter:${step.id}`, when: after.event }, facts, this.steps);
  }

  /** The step's `allow`, plus what the dispatches already written `unlock`; null when nothing is restricted. */
  async #allowedTools(facts) {
    const allowed = allowedToolsOf(this.steps, facts);
    if (allowed === null) return null;
    const unlocked = [];
    for (const dispatch of this.dispatches) {
      if (dispatch.unlocks && (await this.announcer.wasAnnounced(dispatch.id))) unlocked.push(...dispatch.unlocks);
    }
    return [...new Set([...allowed, ...unlocked])];
  }

  /** The step's reminder once the player has been on it `after` turns without doing it, then every `every` turns (once when it has no `every`). */
  #reminderDue(step, turn) {
    if (!step?.reminder || turn - this.stepSince.since < step.reminder.after) return null;
    const { every } = step.reminder;
    if (this.reminded && (every === undefined || turn - this.reminded.turn < every)) return null;
    this.reminded = { turn };
    return tutorialReminderOf(step);
  }

  /** The dispatches whose moment has lasted their `delay` turns (0 = at once). The announcer's once-only rule keeps one from being written twice. */
  #dispatchesDue(facts, turn) {
    const due = [];
    for (const dispatch of this.dispatches) {
      if (!isTutorialMomentOn(dispatch, facts, this.steps)) {
        this.dispatchesSince.delete(dispatch.id);
        continue;
      }
      if (!this.dispatchesSince.has(dispatch.id)) this.dispatchesSince.set(dispatch.id, turn);
      if (turn - this.dispatchesSince.get(dispatch.id) >= dispatch.delay) due.push(dispatch);
    }
    return due;
  }

  /**
   * A toast is due once its moment has lasted its `delay` turns (0 = at once); a toast already on at the first look is recorded as shown. A shown
   * toast is to be taken off when its moment goes off, or as soon as the player has done what it points at (its `until`); one whose `until` already
   * holds when its moment comes is not shown at all.
   * @returns {{ due: object[], dismissed: string[] }}
   */
  #toastsDue(facts, turn) {
    const first = this.toastsState === null;
    const before = this.toastsState ?? new Map();
    const next = new Map();
    const due = [];
    const dismissed = [];
    for (const toast of this.toasts) {
      const previous = before.get(toast.id);
      if (!isTutorialMomentOn(toast, facts, this.steps)) {
        if (previous?.shown && !previous.closed) dismissed.push(toast.id);
        next.set(toast.id, { since: null, shown: false, closed: false });
        continue;
      }
      const state = previous?.since != null ? previous : { since: turn, shown: first, closed: false };
      const done = isTutorialToastDone(toast, facts);
      if (state.shown && !state.closed && done) {
        state.closed = true;
        dismissed.push(toast.id);
      } else if (!state.shown && !done && turn - state.since >= toast.delay) {
        state.shown = true;
        due.push(toast);
      }
      next.set(toast.id, state);
    }
    this.toastsState = next;
    return { due: due.map(tutorialToastOf), dismissed };
  }
}
