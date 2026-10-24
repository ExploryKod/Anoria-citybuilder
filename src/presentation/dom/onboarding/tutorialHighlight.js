/**
 * The tutorial points at a button of the interface. The highlight is one attribute on the body (`data-tutorial-highlight="<target>"`) that
 * tutorial.css reads, so it survives the interface being rebuilt. It goes away when the player clicks the button it points at.
 */

/** The targets a toast may name (`highlight` in the tutorial catalog) and the button each one is. */
const TARGETS = Object.freeze({
  // The house-shaped button that opens the build bar.
  construction: '#toolbar-mobile-toggle',
  // The road tool's own button, next to it.
  road: '#toolbar-road-btn',
  // The button that opens the tutorial's dépêches again.
  history: '#tutorial-history-btn',
  // The button that stops the clock.
  pause: '#pause-btn',
});

let stopWatching = null;

/** @param {keyof typeof TARGETS} target */
export function highlightTarget(target) {
  const selector = TARGETS[target];
  if (!selector) throw new Error(`[tutorial] cannot highlight "${target}": not one of ${Object.keys(TARGETS).join(', ')}`);
  clearHighlight();
  document.body.dataset.tutorialHighlight = target;
  const onClick = (event) => {
    if (event.target instanceof Element && event.target.closest(selector)) clearHighlight();
  };
  document.addEventListener('click', onClick, true);
  stopWatching = () => document.removeEventListener('click', onClick, true);
}

export function clearHighlight() {
  stopWatching?.();
  stopWatching = null;
  delete document.body.dataset.tutorialHighlight;
}
