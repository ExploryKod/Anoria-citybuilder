/**
 * Shared tab handlers — reusable across building ensembles.
 * Group-specific tabs live on the group registry; these are the commons.
 */

import { formatServicesModel } from './presenters/formats/servicesInfoFormat.js';
import { formatMessagesModel } from './presenters/formats/messagesInfoFormat.js';
import { renderServicesTab } from './views/servicesInfoView.js';
import { renderClientPriorityTab } from './views/clientPriorityInfoView.js';
import { renderNeighborsTab, renderMessagesTab } from './layout/buildingInfoLayout.js';
import { BUILDING_INFO_TAB_IDS } from './buildingInfoTabCatalog.js';
import { producedCategories } from '../../../shared/building-catalog/clientQueries.js';

/**
 * @typedef {object} BuildingInfoTabHandler
 * @property {(vm: import('./buildingInfoTypes.js').BuildingInfoViewModel) => unknown} [format]
 * @property {(container: HTMLElement, model: unknown) => void | Promise<void>} render
 * @property {(vm: import('./buildingInfoTypes.js').BuildingInfoViewModel) => boolean} [isVisible]
 *   Opt-in: when present, a false result drops the tab from the strip entirely (not just its
 *   content) — for a tab that is sometimes not applicable at all, not merely empty right now.
 */

/** Common context tabs appended after activity-specific tabs. */
export const COMMON_BUILDING_INFO_TAB_SPECS = Object.freeze([
  { id: BUILDING_INFO_TAB_IDS.services },
  { id: BUILDING_INFO_TAB_IDS.clients },
  { id: BUILDING_INFO_TAB_IDS.neighbors },
  { id: BUILDING_INFO_TAB_IDS.messages },
]);

/** Neighbors + messages only (e.g. nature resources). */
export const CONTEXT_NEIGHBORS_MESSAGES_TAB_SPECS = Object.freeze([
  { id: BUILDING_INFO_TAB_IDS.neighbors },
  { id: BUILDING_INFO_TAB_IDS.messages },
]);

/** @type {Readonly<Record<string, BuildingInfoTabHandler>>} */
export const SHARED_BUILDING_INFO_TAB_HANDLERS = Object.freeze({
  [BUILDING_INFO_TAB_IDS.services]: {
    format: (vm) => formatServicesModel(vm),
    render: (container, model) => renderServicesTab(container, model),
  },
  [BUILDING_INFO_TAB_IDS.clients]: {
    // Only a producer has clients of its own to prioritize — a pure hub (Entrepôt, Moulin, ...)
    // never gets this tab at all, rather than an empty one explaining it doesn't apply.
    isVisible: (vm) => producedCategories(vm.buildingType).length > 0,
    // Whether THIS instance actually has any candidate placed yet is for the view itself to say
    // (see clientPriorityInfoView.js), never a silently empty panel.
    format: (vm) => (vm.uniqueId ? { supply: vm.supply, buildingId: vm.uniqueId, buildingType: vm.buildingType } : null),
    render: (container, model) => renderClientPriorityTab(container, model),
  },
  [BUILDING_INFO_TAB_IDS.neighbors]: {
    format: (vm) => vm.neighborRows,
    render: (container, model) => renderNeighborsTab(container, /** @type {ReadonlyArray<object>} */ (model ?? [])),
  },
  [BUILDING_INFO_TAB_IDS.messages]: {
    format: (vm) => formatMessagesModel(vm),
    render: (container, model) => renderMessagesTab(container, model),
    alwaysRender: true,
  },
});

/**
 * @param {{ id: string, format?: Function, render?: Function, alwaysRender?: boolean, isVisible?: Function }} tabSpec
 * @returns {(BuildingInfoTabHandler & { alwaysRender?: boolean }) | null}
 */
export function resolveBuildingInfoTabHandler(tabSpec) {
  if (typeof tabSpec.format === 'function' && typeof tabSpec.render === 'function') {
    return {
      format: tabSpec.format,
      render: tabSpec.render,
      alwaysRender: tabSpec.alwaysRender === true,
      isVisible: typeof tabSpec.isVisible === 'function' ? tabSpec.isVisible : undefined,
    };
  }
  return SHARED_BUILDING_INFO_TAB_HANDLERS[tabSpec.id] ?? null;
}
