/**
 * Tool-panel gating for the Blue (commerçants) and Purple (savants) house
 * buttons — disabled at boot, unlocked once `housing.getResidentialGroupUnlockStatus()`
 * reports the threshold met (see `ResidentialGroupUnlockPolicy`).
 */

const GATED_HOUSE_BUTTON_IDS = ['House-Blue', 'House-Purple'];

/**
 * Call once at boot, after the button state manager is created. Buttons are
 * usually created lazily (tool panel opened on demand); `disable()` pre-sets
 * the state so it's applied as soon as the button element is registered.
 *
 * @param {{ disable: (buttonId: string) => boolean } | null | undefined} buttonStateManager
 */
export function disableGatedHouseButtons(buttonStateManager) {
  if (!buttonStateManager) return;
  GATED_HOUSE_BUTTON_IDS.forEach((buttonId) => buttonStateManager.disable(buttonId));
}

/**
 * Call periodically (e.g. once per simulation tick) to unlock the gated
 * buttons once the city qualifies. Idempotent — re-enabling an already
 * enabled button is a no-op.
 *
 * @param {object} params
 * @param {{ getResidentialGroupUnlockStatus: () => Promise<{ unlocked: boolean }> } | null | undefined} params.housing
 * @param {{ enable: (buttonId: string) => boolean } | null | undefined} params.buttonStateManager
 */
export async function refreshResidentialGroupGating({ housing, buttonStateManager }) {
  if (!housing?.getResidentialGroupUnlockStatus || !buttonStateManager) return;

  const status = await housing.getResidentialGroupUnlockStatus();
  if (status.unlocked) {
    GATED_HOUSE_BUTTON_IDS.forEach((buttonId) => buttonStateManager.enable(buttonId));
  }
}
