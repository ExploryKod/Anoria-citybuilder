/**
 * House info — view layer (DOM only, no I/O).
 */

import {
  appendHouseholdSkills,
  appendLocationFootnote,
  appendRequirementCards,
  appendStatusMessage,
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
 * @typedef {object} HouseNeedsViewModel
 * @property {string} statusMessage
 * @property {'neutral'|'success'|'warning'|'error'} statusVariant
 * @property {boolean} hasNextTier
 * @property {ReadonlyArray<{ kind: string, icon: string, label: string, met: boolean, valueText: string, ariaLabel: string }>} cards
 */

/**
 * @param {HTMLElement} container
 * @param {HouseNeedsViewModel} model
 */
export function renderHouseNeedsView(container, model) {
  container.innerHTML = '';

  appendStatusMessage(container, model.statusMessage, model.statusVariant);

  if (model.hasNextTier) {
    appendRequirementCards(container, model.cards);
  } else {
    const p = document.createElement('p');
    p.className = 'building-info-status';
    p.textContent = 'Niveau maximal atteint.';
    container.appendChild(p);
  }
}
