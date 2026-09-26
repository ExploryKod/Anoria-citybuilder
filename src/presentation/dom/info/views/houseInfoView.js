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
 * @property {ReadonlyArray<{ kind: string, icon: string, label: string, met: boolean, valueText: string, ariaLabel: string }>} cards
 * @property {ReadonlyArray<{ cards: HouseResourcesViewModel['cards'] }>} [extraNeeds] Further needs the catalog gives the house, one row of cards each.
 */

/**
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
  appendMetricCards(container, model.cards);
  for (const need of model.extraNeeds ?? []) {
    appendMetricCards(container, need.cards);
  }
}
