/**
 * Nature info — view layer (DOM only): the resource as a pie of what is left against what has been consumed, and the buildings that draw on it.
 */

import { buildingName } from '../../shell/CatalogVocabulary.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The remaining share is drawn as an arc over a ring that stands for the whole (the consumed part is what the arc leaves bare). */
function pieOf(resource) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'hub-pie-svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${resource.label} : ${resource.remaining} restants sur ${resource.total}`);
  const ring = (className, length) => {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', className);
    circle.setAttribute('cx', '100');
    circle.setAttribute('cy', '100');
    circle.setAttribute('r', String(RADIUS));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', '34');
    circle.setAttribute('stroke-dasharray', `${length} ${CIRCUMFERENCE}`);
    // The arc starts at the top and runs clockwise.
    circle.setAttribute('transform', 'rotate(-90 100 100)');
    return circle;
  };
  const consumed = ring('nature-pie__consumed', CIRCUMFERENCE);
  const remaining = ring('nature-pie__remaining', CIRCUMFERENCE * (resource.remaining / resource.total));
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('class', 'hub-pie-qty');
  label.setAttribute('x', '100');
  label.setAttribute('y', '106');
  label.setAttribute('text-anchor', 'middle');
  label.textContent = `${resource.consumed}/${resource.total}`;
  svg.append(consumed, remaining, label);
  return svg;
}

/**
 * @param {HTMLElement} container
 * @param {{ terrain: string, resources: Array<{ kind: string, emoji: string, label: string, remaining: number, consumed: number, total: number }> } | null} model
 */
export function renderNatureResourceView(container, model) {
  container.replaceChildren();
  if (!model) return;

  const section = el('section', 'hub-storage-chart-section');
  const body = el('div', 'nature-resource-body');
  section.append(body);

  const show = (resource) => {
    const figure = el('figure', 'hub-pie-figure');
    figure.append(pieOf(resource));
    const legend = el('div', 'hub-pie-legend');
    const remaining = el('div', 'hub-pie-legend-item');
    remaining.append(el('span', 'nature-swatch nature-swatch--remaining'), el('span', 'hub-pie-legend-text', `${resource.emoji} Restant — ${resource.remaining}`));
    const consumed = el('div', 'hub-pie-legend-item');
    consumed.append(el('span', 'nature-swatch nature-swatch--consumed'), el('span', 'hub-pie-legend-text', `Consommé — ${resource.consumed}`));
    legend.append(remaining, consumed);
    const caption = el('p', 'hub-pie-caption');
    caption.append(el('span', 'hub-pie-summary-line', `${resource.consumed} consommés sur ${resource.total}`));
    const details = el('div', 'hub-pie-details');
    details.append(legend, caption);
    const chart = el('div', 'hub-pie-chart');
    chart.append(figure, details);
    body.replaceChildren(chart);
  };

  if (model.resources.length === 0) {
    section.append(el('p', 'building-info-footnote', 'Plus rien à prélever ici.'));
  } else if (model.resources.length === 1) {
    show(model.resources[0]);
  } else {
    // Several deposits (a boulder holds stone, iron, gold): one pill each, the first open.
    const pills = el('div', 'building-info-view-pills');
    pills.setAttribute('role', 'tablist');
    const buttons = new Map();
    for (const resource of model.resources) {
      const button = el('button', 'building-info-view-pill', `${resource.emoji} ${resource.label}`);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => {
        for (const [kind, other] of buttons) {
          other.classList.toggle('is-active', kind === resource.kind);
          other.setAttribute('aria-selected', String(kind === resource.kind));
        }
        show(resource);
      });
      buttons.set(resource.kind, button);
      pills.append(button);
    }
    section.prepend(pills);
    buttons.get(model.resources[0].kind).click();
  }

  container.append(section, el('p', 'building-info-footnote', `Terrain : ${model.terrain}`));
}

/**
 * The Collecteurs tab: the buildings that draw on this resource, each with its name and where it stands.
 * @param {HTMLElement} container
 * @param {{ supply: { listNaturalCollectors: (buildingId: string) => Promise<Array<{ id: string, type: string, x: number, y: number }>> }, buildingId: string } | null} model
 */
export async function renderNatureCollectorsView(container, model) {
  container.replaceChildren();
  if (!model) return;

  let collectors;
  try {
    collectors = await model.supply.listNaturalCollectors(model.buildingId);
  } catch (error) {
    console.error('[NatureCollectors] listNaturalCollectors failed:', error);
    container.append(el('p', 'building-info-footnote', `Erreur : ${error.message}`));
    return;
  }

  if (collectors.length === 0) {
    container.append(el('p', 'building-info-footnote', 'Aucun bâtiment à portée ne prélève cette ressource.'));
    return;
  }

  const table = el('table', 'nature-collectors');
  const caption = el('caption', null, `Bâtiments qui prélèvent ici (${collectors.length})`);
  const body = el('tbody');
  for (const collector of collectors) {
    const row = el('tr');
    const name = el('th', null, buildingName(collector.type));
    name.scope = 'row';
    row.append(name, el('td', null, `📍 (${collector.x}, ${collector.y})`));
    body.append(row);
  }
  table.append(caption, body);
  container.append(table);
}
