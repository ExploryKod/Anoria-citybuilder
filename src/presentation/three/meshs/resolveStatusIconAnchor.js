import { resolveStatusIconPosition } from '../meshUtils.js';
import { STATUS_ICON_ANCHOR_OVERRIDES } from './StatusIconAnchorCatalog.js';

/**
 * Resolves both WHERE and HOW BIG a status icon (no-food, no-road,
 * isBuying, ...) should render on `mesh`: a manual per-building override if
 * one exists in StatusIconAnchorCatalog.js (position and/or scale),
 * otherwise the generic bounding-box-relative position with the given
 * default scale. Single choke point — every status-sprite call site should
 * go through this, not resolveStatusIconPosition directly, so a future
 * tuning pass has exactly one table to edit for both position and scale.
 *
 * @param {import('three').Object3D} mesh
 * @param {string} iconKey
 * @param {{x: number, y: number, z: number}} fallbackOffset
 * @param {{x: number, y: number, z: number}} fallbackScale
 * @returns {{
 *   position: {x: number, y: number, z: number},
 *   scale: {x: number, y: number, z: number},
 * }}
 */
export function resolveIconAppearance(mesh, iconKey, fallbackOffset, fallbackScale) {
  const buildingId = mesh?.userData?.type || mesh?.userData?.id;
  const override = STATUS_ICON_ANCHOR_OVERRIDES[buildingId]?.[iconKey];
  return {
    position: resolveStatusIconPosition(mesh, override?.position ?? fallbackOffset),
    scale: override?.scale ?? fallbackScale,
  };
}
