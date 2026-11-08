/**
 * Group registry — each building ensemble declares its own thematic tabs.
 *
 * Architecture (presentation only):
 * - `tabs[]` = declarative list of tab specs for the group
 * - Custom tabs provide `format` + `render`
 * - Shared tabs (`services`, `messages`) only need `{ id }` —
 *   handlers resolve via `buildingInfoSharedTabs.js`
 */

import { BUILDING_INFO_GROUPS } from '../resolveBuildingInfoGroup.js';
import { BUILDING_INFO_TAB_IDS } from '../buildingInfoTabCatalog.js';
import {
  COMMON_BUILDING_INFO_TAB_SPECS,
  CONTEXT_MESSAGES_TAB_SPECS,
  WORKPLACE_CONTEXT_TAB_SPECS,
} from '../buildingInfoSharedTabs.js';
import { formatSolidityModel } from './formats/solidityFormat.js';
import { formatServicesModel } from './formats/servicesInfoFormat.js';
import { renderBuildingStateView } from '../views/buildingStateTabView.js';
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
  formatHouseSkillsModel,
  formatHouseResourcesModel,
  formatHouseActivityModel,
  formatHouseLayoutHeader,
  formatHouseLayoutOptions,
} from './formats/houseInfoFormat.js';
import {
  formatHubStorageStaffModel,
  formatHubStorageStateModel,
  formatHubStorageRenderParams,
  formatHubStorageLayoutHeader,
  formatHubStorageLayoutOptions,
  formatShelfLifeTabModel,
} from './formats/hubStorageInfoFormat.js';
import {
  formatMarketOverviewModel,
  formatMarketStocksModel,
  formatMarketStaffModel,
  formatMarketLayoutHeader,
  formatMarketLayoutOptions,
} from './formats/marketInfoFormat.js';
import { renderNatureResourceView, renderNatureCollectorsView } from '../views/natureResourceView.js';
import {
  formatNatureResourceModel,
  formatNatureCollectorsModel,
  formatNatureLayoutHeader,
  formatNatureLayoutOptions,
} from './formats/natureInfoFormat.js';
import {
  formatServiceLayoutHeader,
  formatServiceLayoutOptions,
  formatServiceOverviewModel,
  formatServiceStaffModel,
} from './formats/serviceInfoFormat.js';
import { renderHouseSkillsView, renderHouseResourcesView, renderHouseEnterprisesView } from '../views/houseInfoView.js';
import { producedCategories } from '../../../../shared/building-catalog/clientQueries.js';
import { renderHubStorageFoyerView, renderHubStorageOrdersView } from '../views/hub/hubStorageFoyerView.js';
import { renderKvPanelView } from '../views/kvPanelView.js';
import { renderShelfLifeTab } from '../views/shelfLifeTabView.js';
import { renderBuildingFinanceTab } from '../views/buildingFinanceInfoView.js';
import { renderHouseResidentsTab } from '../views/houseResidentsInfoView.js';
import { renderLandPricesTab } from '../views/landPricesView.js';
import { renderProblemsView } from '../views/problemsInfoView.js';
import { formatProblemsModel } from './formats/problemsInfoFormat.js';

/** @typedef {import('../buildingInfoTypes.js').BuildingInfoGroupDefinition} BuildingInfoGroupDefinition */

/**
 * The Finances tab: a house always has one (its wages); a company only when it holds an account, that is when it is a
 * producer, a hub or a seller of goods. Other buildings do not get the tab at all.
 * @type {import('../buildingInfoTypes.js').BuildingInfoTabSpec}
 */
const FINANCE_TAB_SPEC = Object.freeze({
  id: BUILDING_INFO_TAB_IDS.finance,
  isVisible: (vm) => vm.uniqueId != null && vm.accounting.hasBuildingAccount(vm.buildingType),
  format: (vm) => (vm.uniqueId ? { accounting: vm.accounting, buildingId: vm.uniqueId, buildingType: vm.buildingType } : null),
  render: (container, model) => renderBuildingFinanceTab(container, model),
});

/**
 * The Problèmes tab of a workplace: what stands in the way of the building (its road, its purchases, the public aid it asks for); later the strikes.
 * @type {import('../buildingInfoTypes.js').BuildingInfoTabSpec}
 */
const PROBLEMS_TAB_SPEC = Object.freeze({
  id: BUILDING_INFO_TAB_IDS.problems,
  format: (vm) => formatProblemsModel(vm),
  render: (container, model) => renderProblemsView(container, model),
});

/**
 * The État tab of a workplace: what the group says of its state, its staff, and its services row, on one page.
 * @param {{ state: (vm: object) => object | null, staff: (vm: object) => object | null }} formats
 * @returns {import('../buildingInfoTypes.js').BuildingInfoTabSpec}
 */
const stateTabSpec = ({ state, staff }) => ({
  id: BUILDING_INFO_TAB_IDS.state,
  format: (vm) => ({ state: state(vm), staff: staff(vm), services: formatServicesModel(vm), solidity: formatSolidityModel(vm) }),
  render: (container, model) => renderBuildingStateView(container, model),
});

/** The État tab of a building that has nothing but its solidity to say about its state (a house, a generic building): hidden for one with no bar. */
const SOLIDITY_ONLY_STATE_TAB_SPEC = Object.freeze({
  id: BUILDING_INFO_TAB_IDS.state,
  isVisible: (vm) => formatSolidityModel(vm) !== null,
  format: (vm) => ({ state: null, staff: null, services: null, solidity: formatSolidityModel(vm) }),
  render: (container, model) => renderBuildingStateView(container, model),
});

/** @type {Readonly<Record<string, BuildingInfoGroupDefinition>>} */
export const BUILDING_INFO_GROUP_DEFS = Object.freeze({
  [BUILDING_INFO_GROUPS.house]: {
    formatLayoutOptions: formatHouseLayoutOptions,
    formatLayoutHeader: formatHouseLayoutHeader,
    tabs: [
      {
        id: BUILDING_INFO_TAB_IDS.foyer,
        label: '🧠 Savoirs',
        format: formatHouseSkillsModel,
        render: (container, model) => renderHouseSkillsView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.stocks,
        label: '📦 Ressources',
        format: formatHouseResourcesModel,
        render: (container, model) => renderHouseResourcesView(container, model),
      },
      {
        // Two pills: what its businesses make (Productions) and who they serve first (Clients, only for a house that produces goods).
        id: BUILDING_INFO_TAB_IDS.activity,
        format: (vm) => ({
          activity: formatHouseActivityModel(vm),
          clients: producedCategories(vm.buildingType).length > 0 && vm.uniqueId
            ? { supply: vm.supply, buildingId: vm.uniqueId, buildingType: vm.buildingType }
            : null,
        }),
        render: (container, model) => renderHouseEnterprisesView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.residents,
        format: (vm) => (vm.uniqueId ? { accounting: vm.accounting, buildingId: vm.uniqueId, buildingType: vm.buildingType, health: vm.houseHealth } : null),
        render: (container, model) => renderHouseResidentsTab(container, model),
      },
      {
        // Only the owner's house: what its property company sells (land) and at what price
        id: BUILDING_INFO_TAB_IDS.prices,
        isVisible: (vm) => vm.isPropertyOwner === true,
        format: (vm) => ({ land: vm.land }),
        render: (container, model) => renderLandPricesTab(container, model),
      },
      SOLIDITY_ONLY_STATE_TAB_SPEC,
      PROBLEMS_TAB_SPEC,
      // What the house needs to evolve to its next level.
      { id: BUILDING_INFO_TAB_IDS.services, label: '🌱 Évolution' },
      ...CONTEXT_MESSAGES_TAB_SPECS,
      FINANCE_TAB_SPEC,
    ],
  },
  [BUILDING_INFO_GROUPS.nature]: {
    formatLayoutOptions: formatNatureLayoutOptions,
    formatLayoutHeader: formatNatureLayoutHeader,
    tabs: [
      {
        id: BUILDING_INFO_TAB_IDS.foyer,
        label: '🌲 Ressource',
        format: formatNatureResourceModel,
        render: (container, model) => renderNatureResourceView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.collectors,
        format: formatNatureCollectorsModel,
        render: (container, model) => renderNatureCollectorsView(container, model),
      },
      ...CONTEXT_MESSAGES_TAB_SPECS,
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
        id: BUILDING_INFO_TAB_IDS.orders,
        format: formatHubStorageRenderParams,
        render: (container, model) => renderHubStorageOrdersView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.shelfLife,
        format: formatShelfLifeTabModel,
        render: (container, model) => renderShelfLifeTab(container, model),
      },
      stateTabSpec({ state: formatHubStorageStateModel, staff: formatHubStorageStaffModel }),
      PROBLEMS_TAB_SPEC,
      ...WORKPLACE_CONTEXT_TAB_SPECS,
      FINANCE_TAB_SPEC,
    ],
  },
  [BUILDING_INFO_GROUPS.farm]: {
    formatLayoutOptions: formatFarmLayoutOptions,
    formatLayoutHeader: formatFarmLayoutHeader,
    tabs: [
      stateTabSpec({ state: formatFarmOverviewModel, staff: formatFarmStaffModel }),
      PROBLEMS_TAB_SPEC,
      {
        id: BUILDING_INFO_TAB_IDS.stocks,
        format: formatFarmStocksModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.shelfLife,
        format: formatShelfLifeTabModel,
        render: (container, model) => renderShelfLifeTab(container, model),
      },
      {
        id: BUILDING_INFO_TAB_IDS.trade,
        format: formatFarmTradeModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      ...WORKPLACE_CONTEXT_TAB_SPECS,
      FINANCE_TAB_SPEC,
    ],
  },
  [BUILDING_INFO_GROUPS.market]: {
    formatLayoutOptions: formatMarketLayoutOptions,
    formatLayoutHeader: formatMarketLayoutHeader,
    tabs: [
      stateTabSpec({ state: formatMarketOverviewModel, staff: formatMarketStaffModel }),
      PROBLEMS_TAB_SPEC,
      {
        id: BUILDING_INFO_TAB_IDS.stocks,
        format: formatMarketStocksModel,
        render: (container, model) => renderKvPanelView(container, model),
      },
      ...WORKPLACE_CONTEXT_TAB_SPECS,
      FINANCE_TAB_SPEC,
    ],
  },
  [BUILDING_INFO_GROUPS.service]: {
    formatLayoutOptions: formatServiceLayoutOptions,
    formatLayoutHeader: formatServiceLayoutHeader,
    tabs: [
      stateTabSpec({ state: formatServiceOverviewModel, staff: formatServiceStaffModel }),
      PROBLEMS_TAB_SPEC,
      ...WORKPLACE_CONTEXT_TAB_SPECS,
      FINANCE_TAB_SPEC,
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
      SOLIDITY_ONLY_STATE_TAB_SPEC,
      PROBLEMS_TAB_SPEC,
      ...COMMON_BUILDING_INFO_TAB_SPECS,
      FINANCE_TAB_SPEC,
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
