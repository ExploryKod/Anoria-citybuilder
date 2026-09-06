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
 * @property {ReadonlyArray<{ kind: string, icon: string, label: string, met: boolean, valueText: string, ariaLabel: string }>} cards
 */

/**
 * @param {HTMLElement} container
 * @param {HouseResourcesViewModel} model
 */
export function renderHouseResourcesView(container, model) {
  container.innerHTML = '';

  appendMetricCards(container, model.cards);
}
