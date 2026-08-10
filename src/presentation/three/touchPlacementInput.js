import { isTouchModeEnabled } from '../../config/touchMode.js';

/**
 * Touch-first placement (rotation step before confirm).
 * Enabled only when the player turns on "Mode tactile" in Paramètres.
 */
export function prefersTouchPlacementFlow() {
  return isTouchModeEnabled();
}
