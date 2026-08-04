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
    foyerTabLabel: 'building',
    hubOverlayMode: vm.hubKind ?? null,
  };
}

/**
 * Employee panel appended after hub interactive view.
 *
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatHubStorageEmployeesModel(vm) {
  const { hubKind, buildingRow, employment } = vm;
  if (!hubKind) return null;

  const messages = hubKind === 'windmill'
    ? {
        fullyStaffed: '✅ Le moulin tourne à plein régime',
        noWorkers: '❌ Le moulin manque de bras, il ne peut fonctionner',
        partialWorkers: '⚠️ Le moulin tourne avec peine car trop peu d\'employés',
      }
    : {
        fullyStaffed: '✅ La grange peut stocker jusqu\'à sa capacité',
        noWorkers: '❌ Aucun magasinier — stockage impossible',
        partialWorkers: '⚠️ Capacité limitée par le nombre d\'ouvriers',
      };

  return formatWorkplaceEmployeesPanel(buildingRow, messages, employment);
}

/**
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
