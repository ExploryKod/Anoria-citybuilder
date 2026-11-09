/**
 * The tutorial points at a button of the interface. The highlight is one attribute on the body (`data-tutorial-highlight="<target>"`) that
 * tutorial.css reads, so it survives the interface being rebuilt. It goes away when the player clicks the button it points at.
 *
 * Two things point at buttons, so that they pulse together: a toast (`highlightTarget`) and the objective of the step (`keepPointingAt`, for as long as
 * the objective is not reached).
 *
 * A toast may point at several buttons one after the other (a list): the player clicks the first, the next one lights up, and so on until the last is
 * clicked. A target that is not on screen yet (a pill of the build bar, which exists only once the bar is open) is lit as soon as it appears.
 * The objective lights the whole way at once, seen or not: the player may see several buttons pulse and reads the way from them.
 */

import { foldToggleOf } from '../shell/hudFoldGroup.js';
import { isConstructionModeActive } from '../tools/ConstructionMode.js';

/** What a group folding or a carousel scrolling takes to settle, before the way to the target is read again. */
const PATH_SETTLE_MS = 450;

/** The targets a toast may name (`highlight` in the tutorial catalog) and the button each one is. */
const TARGETS = Object.freeze({
  // The hammer: the construction mode's switch, which shows the house, road and eraser buttons.
  constructionMode: '#toolbar-construction-mode-btn',
  // The house-shaped button that opens the build bar (shown while the construction mode runs).
  construction: '#toolbar-mobile-toggle',
  // The road tool's own button, next to it.
  road: '#toolbar-road-btn',
  // The button that opens the tutorial's dépêches again.
  history: '#tutorial-history-btn',
  // The button that stops the clock.
  pause: '#pause-btn',
  // The pills of the build bar: each opens the carousel of its category (the houses; the fields; the market and the granary).
  houses: '.mobile-build-bar__pill[data-category="houses"]',
  artisans: '.mobile-build-bar__pill[data-category="artisans"]',
  // The merchants' pill of the build bar: it opens their carousel (the market, the granary).
  merchants: '.mobile-build-bar__pill[data-category="merchants"]',
});

/** Whether the button of a target is on screen now. */
function isShown(target) {
  const element = document.querySelector(TARGETS[target]);
  return element instanceof HTMLElement && element.offsetParent !== null;
}

/**
 * One slot of highlight. `dataKey` is the body attribute (dataset key) that tutorial.css reads for the target itself; `pulseAttribute` is set on the
 * button that is only a step on the way to it (the target is lit through the body attribute).
 * @param {{ dataKey: string, pulseAttribute: string }} config
 */
function createPointer({ dataKey, pulseAttribute }) {
  let stopWatching = null;
  /** The targets pointed at now (null: none). */
  let pointed = null;

  function clearPulse() {
    delete document.body.dataset[dataKey];
    for (const element of document.querySelectorAll(`[${pulseAttribute}]`)) element.removeAttribute(pulseAttribute);
  }

  function clear() {
    stopWatching?.();
    stopWatching = null;
    pointed = null;
    clearPulse();
  }

  /** @param {keyof typeof TARGETS | Array<keyof typeof TARGETS>} target one target, or several to point at one after the other */
  function point(target) {
    const targets = Array.isArray(target) ? target : [target];
    for (const name of targets) {
      if (!TARGETS[name]) throw new Error(`[tutorial] cannot point at "${name}": not one of ${Object.keys(TARGETS).join(', ')}`);
    }
    clear();
    pointed = targets;
    // Start at the last target already on screen (the build bar is open: its pill is the one to click, not the button that opens it).
    let at = Math.max(0, targets.findLastIndex(isShown));
    let refreshTimer = null;
    const show = () => {
      clearPulse();
      const element = document.querySelector(TARGETS[targets[at]]);
      // The way to the button comes first: the button that unfolds its group, the arrow that pages to it. Each one pulses until pressed, then the next.
      const step = element instanceof HTMLElement ? nextStepTo(element) : null;
      if (step) step.setAttribute(pulseAttribute, '');
      else document.body.dataset[dataKey] = targets[at];
    };
    const showSoon = () => {
      // A group unfolds and a carousel scrolls smoothly: look again once they have moved
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(show, PATH_SETTLE_MS);
    };
    const onClick = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(`[${pulseAttribute}]`)) {
        showSoon();
        return;
      }
      if (!event.target.closest(TARGETS[targets[at]])) return;
      if (at < targets.length - 1) {
        at += 1;
        show();
        // The next button is often in what this click opens (the build bar): read the way to it again once that is on screen
        showSoon();
      } else {
        clear();
      }
    };
    show();
    document.addEventListener('click', onClick, true);
    window.addEventListener('resize', showSoon);
    stopWatching = () => {
      clearTimeout(refreshTimer);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('resize', showSoon);
    };
  }

  return { point, clear, isPointing: () => pointed !== null };
}

const toastPointer = createPointer({ dataKey: 'tutorialHighlight', pulseAttribute: 'data-tutorial-pulse' });

/** @param {keyof typeof TARGETS | Array<keyof typeof TARGETS>} target a toast's target, or several to point at one after the other */
export function highlightTarget(target) {
  toastPointer.point(target);
}

export function clearHighlight() {
  toastPointer.clear();
}

/** Set on every button of the way to the objective (tutorial.css). */
const OBJECTIVE_PULSE_ATTRIBUTE = 'data-tutorial-objective-pulse';
/** The prefix of a target that is a building's button in the build bar (`tool:House-Red`). */
const TOOL_TARGET_PREFIX = 'tool:';
/** The targets the objective of the step keeps pointing at (see `keepPointingAt`), null when it points at none. */
let standing = null;
let standingWatched = false;

/** @param {string} name a name of TARGETS, or `tool:<building id>` @returns {string} the selector of the button(s) */
function selectorOf(name) {
  if (name.startsWith(TOOL_TARGET_PREFIX)) return `.mobile-build-bar [data-toolid="${name.slice(TOOL_TARGET_PREFIX.length)}"]`;
  if (!TARGETS[name]) throw new Error(`[tutorial] cannot point at "${name}": not one of ${Object.keys(TARGETS).join(', ')} or "${TOOL_TARGET_PREFIX}<building id>"`);
  return TARGETS[name];
}

/**
 * Keep pointing at the way to the step's objective for as long as it is not reached: every button of the way pulses at once, seen or not (the player may see
 * several and reads the way from them). To the buttons named are added, for each one, the toggle of its row when the row is folded and the arrows that page
 * the row when it scrolls (a phone). A button that is not on screen yet (the pill, then the building's button, once the bar is open) is lit as soon as it
 * appears: the way is read again after every click. It pulses apart from any toast's own highlight. Null ends it.
 * @param {string | string[] | null} target a name of TARGETS or `tool:<building id>`, or a list of them
 */
export function keepPointingAt(target) {
  standing = target === null ? null : (Array.isArray(target) ? target : [target]);
  for (const name of standing ?? []) selectorOf(name);
  if (standing !== null && !standingWatched) {
    standingWatched = true;
    // A click may fold a row, open the bar or change its category: look again once it has
    document.addEventListener('click', () => setTimeout(pulseObjective, 60), true);
    window.addEventListener('resize', () => setTimeout(pulseObjective, 60));
  }
  pulseObjective();
}

function pulseObjective() {
  for (const element of document.querySelectorAll(`[${OBJECTIVE_PULSE_ATTRIBUTE}]`)) element.removeAttribute(OBJECTIVE_PULSE_ATTRIBUTE);
  if (standing === null) return;
  const way = new Set();
  for (const name of standing) {
    // The mode is on: the way to the objective goes on from the buttons it showed, the hammer has been pressed
    if (name === 'constructionMode' && isConstructionModeActive()) continue;
    for (const button of document.querySelectorAll(selectorOf(name))) {
      way.add(button);
      const toggle = foldToggleOf(button);
      if (toggle) way.add(toggle);
      const scroller = button.closest('[data-page-arrow]');
      if (!(scroller instanceof HTMLElement)) continue;
      for (const arrowId of [scroller.dataset.pageArrow, scroller.dataset.pagePrevArrow]) {
        const arrow = arrowId ? document.getElementById(arrowId) : null;
        if (arrowId && !arrow) throw new Error(`[tutorial] the row names the paging arrow #${arrowId}, which is not on the page`);
        if (arrow && !arrow.hidden) way.add(arrow);
      }
    }
  }
  for (const element of way) element.setAttribute(OBJECTIVE_PULSE_ATTRIBUTE, '');
}

/**
 * The button to press before a target can be pressed, or null when the target is there to press: the toggle of the folded group it hides in, then, in a
 * row that scrolls sideways, the arrow that pages toward it (a scroller names its arrows in `data-page-arrow`, and `data-page-prev-arrow` for the way back).
 * @param {HTMLElement} element
 * @returns {HTMLElement | null}
 */
function nextStepTo(element) {
  const toggle = foldToggleOf(element);
  if (toggle) return toggle;
  const scroller = element.closest('[data-page-arrow]');
  if (!(scroller instanceof HTMLElement)) return null;
  // What the player sees of the row: its padding is where the paging arrow sits, a button under it is not in view
  const frame = scroller.getBoundingClientRect();
  const style = getComputedStyle(scroller);
  const view = { left: frame.left + (parseFloat(style.paddingLeft) || 0), right: frame.right - (parseFloat(style.paddingRight) || 0) };
  const box = element.getBoundingClientRect();
  const ahead = box.right > view.right + 1;
  const behind = box.left < view.left - 1;
  if (!ahead && !behind) return null;
  const arrowId = behind && scroller.dataset.pagePrevArrow ? scroller.dataset.pagePrevArrow : scroller.dataset.pageArrow;
  const arrow = document.getElementById(arrowId);
  if (!arrow) throw new Error(`[tutorial] the row names the paging arrow #${arrowId}, which is not on the page`);
  return arrow.hidden || arrow.disabled ? null : arrow;
}
