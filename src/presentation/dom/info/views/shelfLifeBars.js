import { shelfLifeBarsModel } from '../presenters/formats/shelfLifeFormat.js';
import { getSharedEventBus } from '../../../../composition/sharedEventBus.js';

/**
 * The shelf-life bars of a stock: for each good the building holds, a bar of its whole life (pale green) with the part its oldest batch has already
 * used (red), and what it has left. It follows the game: every turn it reads the building's shelf life again and moves the bars, until the panel it
 * sits in is gone.
 */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * One bar: the track is the whole life of the good, the fill the part used.
 * @param {number} usedFraction 0 (fresh) to 1 (lost)
 * @returns {HTMLElement}
 */
export function shelfLifeBar(usedFraction, { label = 'Durée de vie utilisée', variant = null } = {}) {
  const percent = Math.round(Math.max(0, Math.min(1, usedFraction)) * 100);
  const track = el('div', variant ? `shelf-life-bar shelf-life-bar--${variant}` : 'shelf-life-bar');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', label);
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', String(percent));
  const fill = el('div', 'shelf-life-bar__fill');
  fill.style.width = `${percent}%`;
  track.append(fill);
  return track;
}

/** @param {ReturnType<typeof shelfLifeBarsModel>} goods @returns {HTMLElement[]} */
function rowsOf(goods) {
  return goods.map((good) => {
    const row = el('div', 'shelf-life-live__row');
    const head = el('div', 'shelf-life-live__head');
    head.append(el('span', 'shelf-life-live__name', `${good.icon} ${good.label}`), el('span', 'shelf-life-live__amount', good.amountText));
    // The two bars of a good sit together: how long the stock has left, then how much of what went through it has gone bad.
    const life = el('div', 'shelf-life-live__bar');
    life.append(shelfLifeBar(good.usedFraction), el('div', 'shelf-life-live__remaining', good.remainingText));
    const spoilage = el('div', 'shelf-life-live__bar');
    const spoilageText = el('div', 'shelf-life-live__remaining', `${good.spoilage.text} ${good.spoilage.cycleText}`);
    spoilage.append(shelfLifeBar(good.spoilage.fraction, { label: 'Part périmée du cycle', variant: 'spoilage' }), spoilageText);
    row.append(head, life, spoilage);
    return row;
  });
}

/**
 * Draws the bars into `container` and keeps them current: each turn `load(turn)` is read again, until `container` leaves the page.
 * @param {HTMLElement} container
 * @param {(turn?: number) => Promise<Parameters<typeof shelfLifeBarsModel>[0]>} load reads the building's shelf-life board; without a turn, now
 * @param {string} emptyText what to say while the building holds nothing that can go bad
 * @returns {Promise<void>}
 */
export async function mountShelfLifeBars(container, load, emptyText) {
  const draw = async (turn) => {
    const goods = shelfLifeBarsModel(await load(turn));
    container.replaceChildren(...(goods.length > 0 ? rowsOf(goods) : [el('p', 'shelf-life-note', emptyText)]));
  };
  await draw();

  const unsubscribe = getSharedEventBus().subscribe('game.turnAdvanced', async (event) => {
    if (!container.isConnected) {
      unsubscribe();
      return;
    }
    await draw(event.turn);
  });
}
