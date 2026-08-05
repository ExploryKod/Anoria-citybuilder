/**
 * Presentation — tool-panel gating driven by Housing level-2 unlock queries.
 */

import {
  allGatedPlacementTools,
  ALWAYS_ENABLED_PLACEMENT_TOOLS,
} from '../tools/PlacementToolCatalog.js';

/**
 * @param {{ disable: (buttonId: string) => boolean } | null | undefined} buttonStateManager
 */
export function disableGatedPlacementTools(buttonStateManager) {
  if (!buttonStateManager) return;
  allGatedPlacementTools().forEach((buttonId) => buttonStateManager.disable(buttonId));
  ALWAYS_ENABLED_PLACEMENT_TOOLS.forEach((buttonId) => buttonStateManager.enable(buttonId));
}

/**
 * @param {object} params
 * @param {{
 *   getGroupLevel2UnlockStatus: () => Promise<Readonly<Record<string, boolean>>>,
 *   getPlacementUnlockGroupForBuilding: (buildingId: string) => string | null,
 * } | null | undefined} params.housing
 * @param {{ enable: (buttonId: string) => boolean, disable: (buttonId: string) => boolean } | null | undefined} params.buttonStateManager
 */
export async function refreshSkillPlacementGating({ housing, buttonStateManager }) {
  if (!housing?.getGroupLevel2UnlockStatus || !buttonStateManager) return;

  const unlockStatus = await housing.getGroupLevel2UnlockStatus();

  for (const buttonId of allGatedPlacementTools()) {
    const group = housing.getPlacementUnlockGroupForBuilding?.(buttonId) ?? null;
    if (group) {
      if (unlockStatus[group]) {
        buttonStateManager.enable(buttonId);
      } else {
        buttonStateManager.disable(buttonId);
      }
      continue;
    }

    buttonStateManager.disable(buttonId);
  }

  ALWAYS_ENABLED_PLACEMENT_TOOLS.forEach((buttonId) => buttonStateManager.enable(buttonId));
}
