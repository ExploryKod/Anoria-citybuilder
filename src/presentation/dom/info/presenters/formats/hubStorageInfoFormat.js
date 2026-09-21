/**
 * Hub storage — pure format (hub view model built in enrich step).
 */

import { formatWorkplaceEmployeesPanel } from './workplaceEmployeesFormat.js';

export function formatHubStorageLayoutHeader() {
  return null;
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHubStorageLayoutOptions(vm) {
  return {
    layout: 'centered',
    hubOverlayMode: vm.hubKind ?? null,
  };
}

/**
 * Staff tab — employees for barn / windmill.
 *
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatHubStorageStaffModel(vm) {
  const { hubKind, buildingRow, employment } = vm;
  if (!hubKind) return null;

  return formatWorkplaceEmployeesPanel(buildingRow, employment);
}

/** @deprecated Prefer formatHubStorageStaffModel */
export const formatHubStorageEmployeesModel = formatHubStorageStaffModel;

/**
 * Foyer tab — interactive hub storage params for the hub panel view.
 *
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHubStorageRenderParams(vm) {
  if (!vm.hubKind || !vm.hubView) return null;
  return {
    view: vm.hubView,
    buildingId: vm.uniqueId,
    supply: vm.supply,
    buildingRow: vm.buildingRow,
    supplyView: vm.supplyView,
  };
}

/**
 * The short lines under the hub's pie: how full it is, how long the stock lasts, and what is
 * left of previous harvests. The pie itself carries the goods (icon + amount).
 *
 * @param {{ currentTotal: number, totalCapacity: number, autonomyMonths?: number | null, carryOverTotal?: number }} view
 * @returns {string[]}
 */
export function formatHubStockSummary(view) {
  const lines = [`📦 ${view.currentTotal} / ${view.totalCapacity}`];
  if (view.autonomyMonths != null) {
    lines.push(
      view.autonomyMonths >= 1 ? `⏳ Tient environ ${view.autonomyMonths} mois` : "⏳ Tient moins d'un mois"
    );
  }
  if ((view.carryOverTotal ?? 0) > 0) {
    lines.push(`🗓️ dont ${view.carryOverTotal} des récoltes précédentes`);
  }
  return lines;
}

