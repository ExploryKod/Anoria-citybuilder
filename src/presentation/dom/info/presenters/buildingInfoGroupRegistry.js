/**
 * Group registry — each building ensemble declares its own thematic tabs.
 *
 * Architecture (presentation only):
 * - `tabs[]` = declarative list of tab specs for the group
 * - Custom tabs provide `format` + `render`
 * - Shared tabs (`services`, `neighbors`, `messages`) only need `{ id }` —
 *   handlers resolve via `buildingInfoSharedTabs.js`
 */

import { BUILDING_INFO_GROUPS } from '../resolveBuildingInfoGroup.js';
import { BUILDING_INFO_TAB_IDS } from '../buildingInfoTabCatalog.js';
import {
  COMMON_BUILDING_INFO_TAB_SPECS,
  CONTEXT_NEIGHBORS_MESSAGES_TAB_SPECS,
} from '../buildingInfoSharedTabs.js';
import {
  formatFarmOverviewModel,
  formatFarmStocksModel,
  formatFarmTradeModel,
  formatFarmStaffModel,
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
  formatHouseDietModel,
  formatHouseLayoutHeader,
  formatHouseLayoutOptions,
} from './formats/houseInfoFormat.js';
import {
  formatHubStorageStaffModel,
  formatHubStorageRenderParams,
  formatHubStorageLayoutHeader,
  formatHubStorageLayoutOptions,
} from './formats/hubStorageInfoFormat.js';
import {
  formatMarketOverviewModel,
  formatMarketStocksModel,
  formatMarketStaffModel,
  formatMarketLayoutHeader,
  formatMarketLayoutOptions,
} from './formats/marketInfoFormat.js';
import {
  formatNatureFoyerModel,
  formatNatureLayoutHeader,
  formatNatureLayoutOptions,
} from './formats/natureInfoFormat.js';
import { renderHouseFoyerView } from '../views/houseInfoView.js';
import { renderDietTab } from '../views/dietInfoView.js';
import { renderHubStorageFoyerView } from '../views/hub/hubStorageFoyerView.js';
import { renderKvPanelView } from '../views/kvPanelView.js';

/** @typedef {import('../buildingInfoTypes.js').BuildingInfoGroupDefinition} BuildingInfoGroupDefinition */

/** @type {Readonly<Record<string, BuildingInfoGroupDefinition>>} */
export const BUILDING_INFO_GROUP_DEFS = Object.freeze({
  [BUILDING_INFO_GROUPS.house]: {
    formatLayoutOptions: formatHouseLayoutOptions,
    formatLayoutHeader: formatHouseLayoutHeader,
    tabs: [
      {
        id: BUILDING_INFO_TAB_IDS.foyer,
        label: '🏠 Foyer',
        format: formatHouseFoyerModel,
        render: (container, model) => renderHouseFoyerView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.diet,
        format: formatHouseDietModel,
        render: (container, model) => renderDietTab(container, model),
      },
      ...COMMON_BUILDING_INFO_TAB_SPECS,
    ],
  },
  [BUILDING_INFO_GROUPS.nature]: {
    formatLayoutOptions: formatNatureLayoutOptions,
    formatLayoutHeader: formatNatureLayoutHeader,
    tabs: [
      {
        id: BUILDING_INFO_TAB_IDS.foyer,
        label: '🌲 Ressource',
        format: formatNatureFoyerModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      ...CONTEXT_NEIGHBORS_MESSAGES_TAB_SPECS,
    ],
  },
  [BUILDING_INFO_GROUPS.hubStorage]: {
    formatLayoutOptions: formatHubStorageLayoutOptions,
    formatLayoutHeader: formatHubStorageLayoutHeader,
    tabs: [
      {
        id: BUILDING_INFO_TAB_IDS.foyer,
        label: '📦 Stockage',
        format: formatHubStorageRenderParams,
        render: (container, model) => renderHubStorageFoyerView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.staff,
        format: formatHubStorageStaffModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      ...COMMON_BUILDING_INFO_TAB_SPECS,
    ],
  },
  [BUILDING_INFO_GROUPS.farm]: {
    formatLayoutOptions: formatFarmLayoutOptions,
    formatLayoutHeader: formatFarmLayoutHeader,
    tabs: [
      {
        id: BUILDING_INFO_TAB_IDS.foyer,
        label: '🌾 Culture',
        format: formatFarmOverviewModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.stocks,
        format: formatFarmStocksModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.trade,
        format: formatFarmTradeModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.staff,
        format: formatFarmStaffModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      ...COMMON_BUILDING_INFO_TAB_SPECS,
    ],
  },
  [BUILDING_INFO_GROUPS.market]: {
    formatLayoutOptions: formatMarketLayoutOptions,
    formatLayoutHeader: formatMarketLayoutHeader,
    tabs: [
      {
        id: BUILDING_INFO_TAB_IDS.foyer,
        label: '🏪 État',
        format: formatMarketOverviewModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.stocks,
        format: formatMarketStocksModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.staff,
        format: formatMarketStaffModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      ...COMMON_BUILDING_INFO_TAB_SPECS,
    ],
  },
  [BUILDING_INFO_GROUPS.generic]: {
    formatLayoutOptions: formatGenericLayoutOptions,
    formatLayoutHeader: formatGenericLayoutHeader,
    tabs: [
      {
        id: BUILDING_INFO_TAB_IDS.foyer,
        format: formatGenericFoyerModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      ...COMMON_BUILDING_INFO_TAB_SPECS,
    ],
  },
});

/**
 * @param {import('../resolveBuildingInfoGroup.js').BuildingInfoGroupId} groupId
 * @returns {BuildingInfoGroupDefinition}
 */
export function getBuildingInfoGroupDef(groupId) {
  return BUILDING_INFO_GROUP_DEFS[groupId] ?? BUILDING_INFO_GROUP_DEFS[BUILDING_INFO_GROUPS.generic];
}
