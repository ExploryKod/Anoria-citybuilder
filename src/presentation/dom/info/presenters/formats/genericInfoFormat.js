/**
 * Generic building — pure format.
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatGenericLayoutHeader(vm) {
  const def = getBuildingDefinition(vm.buildingType);
  return {
    title: def?.displayName ?? vm.buildingType,
    meta: `📍 (${vm.anchorX}, ${vm.anchorY}) · 👥 ${vm.buildingPop}`,
    accent: null,
  };
}

export function formatGenericLayoutOptions() {
  return { layout: 'centered', foyerTabLabel: 'building', hubOverlayMode: null };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel}
 */
export function formatGenericFoyerModel(vm) {
  const { buildingType, anchorX, anchorY, terrainLabel, buildingPop } = vm;
  return {
    sections: [{
      title: 'Bâtiment',
      rows: [
        { label: 'Type', value: buildingType },
        { label: 'Adresse', value: `x: ${anchorX} | y: ${anchorY}` },
        { label: 'Terrain', value: terrainLabel },
        { label: 'Habitants', value: buildingPop },
      ],
    }],
  };
}
