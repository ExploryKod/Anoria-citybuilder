/**
 * House info — view layer (DOM only, no I/O).
 */

import {
  appendGroupedStockSections,
  appendHouseholdComposition,
  appendLocationFootnote,
  appendStatusMessage,
} from '../layout/buildingInfoLayout.js';

/**
 * @typedef {object} HouseFoyerViewModel
 * @property {string} statusMessage
 * @property {'neutral'|'success'|'warning'|'error'} statusVariant
 * @property {{ hunters: number, artisans: number }} composition
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
  appendHouseholdComposition(container, model.composition);

  if (model.stockGroups) {
    appendGroupedStockSections(container, model.stockGroups);
  }

  appendLocationFootnote(container, model.anchorX, model.anchorY);
}
