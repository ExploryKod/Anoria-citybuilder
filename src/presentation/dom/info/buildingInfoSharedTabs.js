/**
 * Shared tab handlers — reusable across building ensembles.
 * Group-specific tabs live on the group registry; these are the commons.
 */

import { formatServicesModel } from './presenters/formats/servicesInfoFormat.js';
import { renderServicesTab } from './views/servicesInfoView.js';
import { renderNeighborsTab, renderMessagesTab } from './layout/buildingInfoLayout.js';
import { BUILDING_INFO_TAB_IDS } from './buildingInfoTabCatalog.js';

/**
 * @typedef {object} BuildingInfoTabHandler
 * @property {(vm: import('./buildingInfoTypes.js').BuildingInfoViewModel) => unknown} [format]
 * @property {(container: HTMLElement, model: unknown) => void | Promise<void>} render
 */

/** Common context tabs appended after activity-specific tabs. */
export const COMMON_BUILDING_INFO_TAB_SPECS = Object.freeze([
  { id: BUILDING_INFO_TAB_IDS.services },
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
  [BUILDING_INFO_TAB_IDS.neighbors]: {
    format: (vm) => vm.neighborRows,
    render: (container, model) => renderNeighborsTab(container, /** @type {ReadonlyArray<object>} */ (model ?? [])),
  },
  [BUILDING_INFO_TAB_IDS.messages]: {
    format: () => null,
    render: (container) => renderMessagesTab(container),
    alwaysRender: true,
  },
});

/**
 * @param {{ id: string, format?: Function, render?: Function, alwaysRender?: boolean }} tabSpec
 * @returns {(BuildingInfoTabHandler & { alwaysRender?: boolean }) | null}
 */
export function resolveBuildingInfoTabHandler(tabSpec) {
  if (typeof tabSpec.format === 'function' && typeof tabSpec.render === 'function') {
    return {
      format: tabSpec.format,
      render: tabSpec.render,
      alwaysRender: tabSpec.alwaysRender === true,
    };
  }
  return SHARED_BUILDING_INFO_TAB_HANDLERS[tabSpec.id] ?? null;
}
