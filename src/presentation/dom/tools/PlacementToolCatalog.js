/**
 * Presentation — which placement tool buttons exist and which stay always on.
 */

import { buildingCatalog } from '../../../shared/building-catalog/buildingCatalog.js';
import { houses } from '../../../shared/building-catalog/buildingCategories.js';

export const ALWAYS_ENABLED_PLACEMENT_TOOLS = Object.freeze([
  ...houses,
  'roads',
  'StonePath-001',
  'StonePath-Right-001',
  'StonePath-Left-001',
  'StonePath-Cross-001',
]);

/** @returns {ReadonlyArray<string>} */
export function allGatedPlacementTools() {
  return Object.freeze(
    Object.keys(buildingCatalog).filter(
      (id) => !['grass', 'terrain'].includes(id)
        && !ALWAYS_ENABLED_PLACEMENT_TOOLS.includes(id),
    ),
  );
}
