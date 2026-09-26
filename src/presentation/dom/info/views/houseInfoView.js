/**
 * House info — view layer (DOM only, no I/O).
 */

import {
  appendHouseholdSkills,
  appendLocationFootnote,
  appendMetricCards,
} from '../layout/buildingInfoLayout.js';

/**
 * @typedef {object} HouseSkillsDisplayItem
 * @property {string} emoji
 * @property {number} count
 * @property {string} label
 * @property {string} ariaLabel
 */

/**
 * @typedef {object} HouseSkillsViewModel
 * @property {ReadonlyArray<HouseSkillsDisplayItem>} skills
 * @property {number} anchorX
 * @property {number} anchorY
 */

/**
 * @param {HTMLElement} container
 * @param {HouseSkillsViewModel} model
 */
export function renderHouseSkillsView(container, model) {
  container.innerHTML = '';

  appendHouseholdSkills(container, model.skills);
  appendLocationFootnote(container, model.anchorX, model.anchorY);
}

/**
 * @typedef {object} HouseResourcesViewModel
 * @property {string} [caption] Says what the figures below are (e.g. "Consommé le mois dernier :")
 * @property {ReadonlyArray<{ kind: string, card: object, details: ReadonlyArray<object> }>} needs One per need:
 *   its own card, and the cards of its goods shown once it is picked.
 */

/**
 * The needs as cards, the first (the diet) picked from the start; the cards of the picked need's goods sit
 * under them. One need is always picked, so the detail never disappears.
 * @param {HTMLElement} container
 * @param {HouseResourcesViewModel} model
 */
export function renderHouseResourcesView(container, model) {
  container.innerHTML = '';

  if (model.caption) {
    const caption = document.createElement('p');
    caption.className = 'building-info-footnote';
    caption.textContent = model.caption;
    container.appendChild(caption);
  }
  if (model.needs.length === 0) return;

  const detail = document.createElement('div');
  detail.className = 'building-info-metrics-detail';
  const needByKind = new Map(model.needs.map((need) => [need.kind, need]));

  let grid = null;
  const pick = (kind) => {
    grid?.querySelectorAll('button').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(model.needs[index].kind === kind));
    });
    detail.innerHTML = '';
    appendMetricCards(detail, needByKind.get(kind).details);
  };

  grid = appendMetricCards(container, model.needs.map((need) => need.card), { onSelect: (card) => pick(card.kind) });
  container.appendChild(detail);
  pick(model.needs[0].kind);
}
