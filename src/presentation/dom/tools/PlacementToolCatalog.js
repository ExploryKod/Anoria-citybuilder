/**
 * Presentation — which placement tool buttons exist and which stay always on.
 */

import { getPlayableBuildingIds } from '../../../shared/building-catalog/assetsPrices.js';
import { farms } from '../../../shared/building-catalog/buildingCategories.js';

const ROAD_TOOL_IDS = Object.freeze([
  'StonePath-001',
  'StonePath-Right-001',
  'StonePath-Left-001',
  'StonePath-Cross-001',
]);

export const ALWAYS_ENABLED_PLACEMENT_TOOLS = Object.freeze([
  ...farms,
  'Hay-Bale',
  'Hay-Cart',
  'Hay-Pile',
  ...ROAD_TOOL_IDS,
]);

/** @returns {ReadonlyArray<string>} */
export function allGatedPlacementTools() {
  return Object.freeze(
    getPlayableBuildingIds().filter(
      (id) => !ALWAYS_ENABLED_PLACEMENT_TOOLS.includes(id),
    ),
  );
}
