/**
 * The tutorial's objective counter: a small pill in the strip above the bottom buttons (#hud-pills, "Maisons « Artisans » 2/3"), pulsing, so the player always
 * knows what the step asks. When a step is finished its counter stays on screen, full and marked done, for a moment before the next step's takes its place.
 */

const DONE_HOLD_MS = 3500;

let holdTimer = null;
/** @type {{ label: string, have: number, target: number } | null} the counter of the current step, shown once a finished one has had its moment */
let latest = null;

function elements() {
  const root = document.getElementById('tutorial-objective');
  if (!root) throw new Error('[tutorial objective] #tutorial-objective is missing from game.html');
  return {
    root,
    label: root.querySelector('.tutorial-objective__label'),
    count: root.querySelector('.tutorial-objective__count'),
  };
}

function render(progress, done) {
  const { root, label, count } = elements();
  root.hidden = progress === null;
  root.classList.toggle('tutorial-objective--done', done);
  if (progress === null) return;
  label.textContent = progress.label;
  count.textContent = `${progress.have}/${progress.target}`;
}

/**
 * @param {{ progress: { label: string, have: number, target: number } | null, justCompleted: { label: string, have: number, target: number } | null }} state
 *   what `advanceTutorial` answered: the current step's counter, and the counter of a step just finished
 */
export function showTutorialObjective({ progress, justCompleted }) {
  latest = progress;
  if (justCompleted) {
    clearTimeout(holdTimer);
    render(justCompleted, true);
    holdTimer = setTimeout(() => {
      holdTimer = null;
      render(latest, false);
    }, DONE_HOLD_MS);
    return;
  }
  // A finished counter keeps the line until its moment is over.
  if (holdTimer === null) render(progress, false);
}
