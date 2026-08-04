/**
 * Group registry — relie chaque type de bâtiment à ses formats + vue foyer.
 */

import { BUILDING_INFO_GROUPS } from '../resolveBuildingInfoGroup.js';
import {
  formatFarmFoyerModel,
  formatFarmLayoutHeader,
  formatFarmLayoutOptions,
} from './formats/farmInfoFormat.js';
import {
  formatGenericFoyerModel,
  formatGenericLayoutHeader,
  formatGenericLayoutOptions,
} from './formats/genericInfoFormat.js';
import {
  formatHouseFoyerModel,
  formatHouseLayoutHeader,
  formatHouseLayoutOptions,
} from './formats/houseInfoFormat.js';
import {
  formatHubStorageEmployeesModel,
  formatHubStorageRenderParams,
  formatHubStorageLayoutHeader,
  formatHubStorageLayoutOptions,
} from './formats/hubStorageInfoFormat.js';
import {
  formatMarketFoyerModel,
  formatMarketLayoutHeader,
  formatMarketLayoutOptions,
} from './formats/marketInfoFormat.js';
import {
  formatNatureFoyerModel,
  formatNatureLayoutHeader,
  formatNatureLayoutOptions,
} from './formats/natureInfoFormat.js';
import { renderHouseFoyerView } from '../views/houseInfoView.js';
import { renderHubStorageFoyerView } from '../views/hub/hubStorageFoyerView.js';
import { renderKvPanelView } from '../views/kvPanelView.js';

/** @typedef {import('../buildingInfoTypes.js').BuildingInfoGroupDefinition} BuildingInfoGroupDefinition */

/** @type {Readonly<Record<string, BuildingInfoGroupDefinition>>} */
export const BUILDING_INFO_GROUP_DEFS = Object.freeze({
  [BUILDING_INFO_GROUPS.house]: {
    formatLayoutOptions: formatHouseLayoutOptions,
    formatLayoutHeader: formatHouseLayoutHeader,
    formatFoyer: formatHouseFoyerModel,
    renderFoyer: (container, model) => renderHouseFoyerView(container, model),
  },
  [BUILDING_INFO_GROUPS.nature]: {
    formatLayoutOptions: formatNatureLayoutOptions,
    formatLayoutHeader: formatNatureLayoutHeader,
    formatFoyer: formatNatureFoyerModel,
    renderFoyer: (container, model) => renderKvPanelView(container, model),
  },
  [BUILDING_INFO_GROUPS.hubStorage]: {
    formatLayoutOptions: formatHubStorageLayoutOptions,
    formatLayoutHeader: formatHubStorageLayoutHeader,
    formatFoyer: (vm) => ({
      hubParams: formatHubStorageRenderParams(vm),
      employees: formatHubStorageEmployeesModel(vm),
    }),
    renderFoyer: (container, model) => renderHubStorageFoyerView(container, model),
  },
  [BUILDING_INFO_GROUPS.farm]: {
    formatLayoutOptions: formatFarmLayoutOptions,
    formatLayoutHeader: formatFarmLayoutHeader,
    formatFoyer: formatFarmFoyerModel,
    renderFoyer: (container, model) => renderKvPanelView(container, model),
  },
  [BUILDING_INFO_GROUPS.market]: {
    formatLayoutOptions: formatMarketLayoutOptions,
    formatLayoutHeader: formatMarketLayoutHeader,
    formatFoyer: formatMarketFoyerModel,
    renderFoyer: (container, model) => renderKvPanelView(container, model),
  },
  [BUILDING_INFO_GROUPS.generic]: {
    formatLayoutOptions: formatGenericLayoutOptions,
    formatLayoutHeader: formatGenericLayoutHeader,
    formatFoyer: formatGenericFoyerModel,
    renderFoyer: (container, model) => renderKvPanelView(container, model),
  },
});

/**
 * @param {import('../resolveBuildingInfoGroup.js').BuildingInfoGroupId} groupId
 * @returns {BuildingInfoGroupDefinition}
 */
export function getBuildingInfoGroupDef(groupId) {
  return BUILDING_INFO_GROUP_DEFS[groupId] ?? BUILDING_INFO_GROUP_DEFS[BUILDING_INFO_GROUPS.generic];
}
