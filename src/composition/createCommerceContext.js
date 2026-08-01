import { getTimeManager } from '../js/acl/appRuntime.js';
import { recordImportExpense, recordExportIncome } from '../js/acl/accountingGame.js';
import { instanceIdFromHouseRow } from '../js/acl/building-identity.js';
import {
  listCommercializableWindmills,
  getSupplyBuildingRow,
  updateSupplyBuildingFields,
  listWindmillSupplyViews,
} from '../js/acl/supply.js';
import { LocalStorageCommerceRepository } from '../contexts/commerce/infrastructure/persistence/LocalStorageCommerceRepository.js';
import { CommerceSimulationService } from '../contexts/commerce/application/services/CommerceSimulationService.js';

/** @type {ReturnType<typeof createCommerceContext>|null} */
let sharedCommerce = null;

/** @type {((payload: object) => void)|null} */
let partnerContractFinishedHandler = null;

/**
 * @param {object} [deps]
 * @param {LocalStorageCommerceRepository} [deps.commerceRepository]
 * @param {((payload: object) => void)|null} [deps.onPartnerContractFinished]
 */
export function createCommerceContext(deps = {}) {
  const commerceRepository = deps.commerceRepository ?? new LocalStorageCommerceRepository();

  const getTimeInfo = (time) => getTimeManager().getTimeInfo(time);

  const simulationDeps = {
    commerceRepository,
    recordImportExpense,
    recordExportIncome,
    listCommercializableWindmills,
    getSupplyBuildingRow,
    updateSupplyBuildingFields,
    listWindmillSupplyViews,
    getTimeInfo,
    instanceIdFromHouseRow,
    onPartnerContractFinished:
      deps.onPartnerContractFinished ??
      partnerContractFinishedHandler ??
      null,
  };

  const simulation = new CommerceSimulationService(simulationDeps);

  return {
    commerceRepository,
    simulation,
    simulationDeps,
    clear() {
      commerceRepository.clear();
    },
  };
}

/** @param {object} [deps] */
export function getOrCreateCommerceContext(deps = {}) {
  if (!sharedCommerce) {
    sharedCommerce = createCommerceContext(deps);
  }
  return sharedCommerce;
}

/** @param {(payload: object) => void|null} handler */
export function setCommercePartnerContractFinishedHandler(handler) {
  partnerContractFinishedHandler = handler;
  if (sharedCommerce?.simulation) {
    sharedCommerce.simulation.onPartnerContractFinished = handler;
  }
}

/** @internal Tests only */
export function resetCommerceContextForTests() {
  sharedCommerce = null;
  partnerContractFinishedHandler = null;
}
