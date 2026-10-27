/**
 * Nature — pure format.
 */

import { depositKindsOf } from '../../../../../shared/building-catalog/depositQueries.js';
import { buildingName, goodIcon, goodLabel } from '../../../shell/CatalogVocabulary.js';

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatNatureLayoutHeader(vm) {
  return {
    title: buildingName(vm.buildingType),
    meta: `📍 (${vm.anchorX}, ${vm.anchorY})`,
    accent: null,
  };
}

export function formatNatureLayoutOptions() {
  return { layout: 'centered', hubOverlayMode: null };
}

/**
 * Ressource tab — for each kind of deposit the resource holds (the catalog says which), what is left of it over what it started with.
 * A kind it holds none of (a boulder with no gold) is not listed.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ terrain: string, resources: Array<{ kind: string, emoji: string, label: string, remaining: number, consumed: number, total: number }> }}
 */
export function formatNatureResourceModel(vm) {
  const { buildingType, terrainLabel, buildingRow, stocks } = vm;
  const remainingStocks = stocks ?? buildingRow?.stocks ?? {};
  const totals = buildingRow?.maxStocks ?? {};

  const resources = depositKindsOf(buildingType)
    .filter((kind) => (totals[kind] ?? 0) > 0)
    .map((kind) => {
      const total = totals[kind];
      const remaining = Math.min(total, Math.max(0, remainingStocks[kind] ?? 0));
      return { kind, emoji: goodIcon(kind), label: goodLabel(kind), remaining, consumed: total - remaining, total };
    });

  return { terrain: terrainLabel, resources };
}

/**
 * Collecteurs tab — what is needed to read the buildings that draw on this resource.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ supply: object, buildingId: string } | null}
 */
export function formatNatureCollectorsModel(vm) {
  return vm.uniqueId ? { supply: vm.supply, buildingId: vm.uniqueId } : null;
}
