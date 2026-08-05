/**
 * House info — view layer (DOM only, no I/O).
 */

import {
  appendGroupedStockSections,
  appendHouseholdProfiles,
  appendHouseholdSkills,
  appendLocationFootnote,
  appendStatusMessage,
} from '../layout/buildingInfoLayout.js';

/**
 * @typedef {object} HousePopulationDisplayItem
 * @property {string} emoji
 * @property {number} count
 * @property {string} label
 * @property {string} ariaLabel
 */

/**
 * @typedef {object} HouseFoyerViewModel
 * @property {string} statusMessage
 * @property {'neutral'|'success'|'warning'|'error'} statusVariant
 * @property {ReadonlyArray<HousePopulationDisplayItem>} profiles
 * @property {ReadonlyArray<HousePopulationDisplayItem>} skills
 * @property {number} anchorX
 * @property {number} anchorY
 * @property {{
 *   subsistence: ReadonlyArray<{ emoji: string, value: number, ariaLabel: string }>,
 *   farms: ReadonlyArray<{ emoji: string, value: number, ariaLabel: string }>,
 *   showSubsistence: boolean,
 * } | null} stockGroups
 */

/**
 * @param {HTMLElement} container
 * @param {HouseFoyerViewModel} model
 */
export function renderHouseFoyerView(container, model) {
  container.innerHTML = '';

  appendStatusMessage(container, model.statusMessage, model.statusVariant);
  appendHouseholdProfiles(container, model.profiles);
  appendHouseholdSkills(container, model.skills);

  if (model.stockGroups) {
    appendGroupedStockSections(container, model.stockGroups);
  }

  appendLocationFootnote(container, model.anchorX, model.anchorY);
}
