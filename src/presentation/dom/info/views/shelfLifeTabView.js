import { shelfLifeReferenceModel } from '../presenters/formats/shelfLifeFormat.js';
import { mountShelfLifeBars } from './shelfLifeBars.js';

/**
 * The Shelf-life tab of a building that keeps goods (a farm, a granary, a warehouse): the live bars of what its stock has left to live, and the
 * reference of how long each good keeps.
 */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * @param {HTMLElement} container
 * @param {{ load: (turn?: number) => Promise<object> } | null} model
 */
export async function renderShelfLifeTab(container, model) {
  container.replaceChildren();
  if (!model) return;

  const stock = el('section', 'shelf-life-section');
  stock.append(el('h3', 'shelf-life-section__title', 'Ce stock'));
  const bars = el('div', 'shelf-life-live');
  stock.append(bars);

  const { perishable, lasting } = shelfLifeReferenceModel();
  // The reference is not always on screen: a pill opens it and closes it.
  const reference = el('section', 'shelf-life-section');
  const toggle = el('button', 'shelf-life-pill', 'Durées de conservation de chaque bien');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const details = el('div', 'shelf-life-reference');
  details.hidden = true;
  toggle.addEventListener('click', () => {
    details.hidden = !details.hidden;
    toggle.setAttribute('aria-expanded', String(!details.hidden));
  });
  reference.append(toggle, details);
  const table = el('table', 'shelf-life-table');
  const head = el('tr');
  for (const label of ['Bien', 'Seul', 'Dans un lieu qui le conserve']) head.append(el('th', null, label));
  table.append(head);
  for (const good of perishable) {
    const row = el('tr');
    row.append(el('td', null, `${good.icon} ${good.label}`), el('td', null, good.baseText), el('td', null, good.places.length > 0 ? good.places.join(' · ') : '—'));
    table.append(row);
  }
  details.append(table);
  if (lasting.length > 0) details.append(el('p', 'shelf-life-note', `Ne se périment pas : ${lasting.join(', ')}.`));

  container.append(stock, reference);
  await mountShelfLifeBars(bars, model.load, 'Rien ne se périme ici pour le moment.');
}
