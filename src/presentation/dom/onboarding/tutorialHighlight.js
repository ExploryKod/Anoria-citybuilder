/**
 * The tutorial points at a button of the interface. The highlight is one attribute on the body (`data-tutorial-highlight="<target>"`) that
 * tutorial.css reads, so it survives the interface being rebuilt. It goes away when the player clicks the button it points at.
 *
 * A toast may point at several buttons one after the other (a list): the player clicks the first, the next one lights up, and so on until the last is
 * clicked. A target that is not on screen yet (a pill of the build bar, which exists only once the bar is open) is lit as soon as it appears.
 */

import { unfoldGroupOf } from '../shell/hudFoldGroup.js';

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
  // The merchants' pill of the build bar: it opens their carousel (the market, the granary).
  merchants: '.mobile-build-bar__pill[data-category="merchants"]',
});

let stopWatching = null;

/** Whether the button of a target is on screen now. */
function isShown(target) {
  const element = document.querySelector(TARGETS[target]);
  return element instanceof HTMLElement && element.offsetParent !== null;
}

/** @param {keyof typeof TARGETS | Array<keyof typeof TARGETS>} target one target, or several to point at one after the other */
export function highlightTarget(target) {
  const targets = Array.isArray(target) ? target : [target];
  for (const name of targets) {
    if (!TARGETS[name]) throw new Error(`[tutorial] cannot highlight "${name}": not one of ${Object.keys(TARGETS).join(', ')}`);
  }
  clearHighlight();
  // Start at the last target already on screen (the build bar is open: its pill is the one to click, not the button that opens it).
  let at = Math.max(0, targets.findLastIndex(isShown));
  const show = () => {
    document.body.dataset.tutorialHighlight = targets[at];
    // The button pulsing must be there to be pressed: its group of the bottom bars is unfolded if the player had folded it.
    unfoldGroupOf(document.querySelector(TARGETS[targets[at]]));
  };
  const onClick = (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(TARGETS[targets[at]])) return;
    if (at < targets.length - 1) {
      at += 1;
      show();
    } else {
      clearHighlight();
    }
  };
  show();
  document.addEventListener('click', onClick, true);
  stopWatching = () => document.removeEventListener('click', onClick, true);
}

export function clearHighlight() {
  stopWatching?.();
  stopWatching = null;
  delete document.body.dataset.tutorialHighlight;
}
