import {
  currentTutorialStep,
  tutorialDraftOf,
  validateTutorialSteps,
} from '../../domain/policies/TutorialProgressPolicy.js';

/**
 * Moves the tutorial on: reads the city's facts, finds the step the player is on and gives its instruction as a dépêche. Called after a
 * placement and at the end of a turn; it holds no progress of its own (the step is derived from the facts, the once-only announcement belongs to
 * the news), so calling it often is harmless.
 */
export class AdvanceTutorial {
  /**
   * @param {object} deps
   * @param {ReadonlyArray<import('../../domain/policies/TutorialProgressPolicy.js').TutorialStep>} deps.steps
   * @param {() => boolean} deps.isActive whether this game runs the tutorial (the composition root decides; the domain reads no session)
   * @param {import('../ports/TutorialFactsPort.js').TutorialFactsPort} deps.facts
   * @param {import('../ports/TutorialAnnouncerPort.js').TutorialAnnouncerPort} deps.announcer
   * @param {() => number} deps.getGameTime
   */
  constructor({ steps, isActive, facts, announcer, getGameTime }) {
    validateTutorialSteps(steps);
    this.steps = steps;
    this.isActive = isActive;
    this.facts = facts;
    this.announcer = announcer;
    this.getGameTime = getGameTime;
  }

  /**
   * @returns {Promise<object | null>} the dépêche just written, or null (not a tutorial game, the step says nothing, it was announced before, or the script is over)
   */
  async execute() {
    if (!this.isActive()) return null;
    const step = currentTutorialStep(this.steps, await this.facts.read());
    if (!step?.news) return null;
    return this.announcer.announce({ stepId: step.id, turn: this.getGameTime(), ...tutorialDraftOf(step) });
  }
}
