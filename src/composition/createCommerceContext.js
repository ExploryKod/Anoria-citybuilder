import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { instanceIdFromHouseRow } from '../shared/building-identity/index.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { LocalStorageCommerceRepository } from '../contexts/commerce/infrastructure/persistence/LocalStorageCommerceRepository.js';
import { CommerceSimulationService } from '../contexts/commerce/application/services/CommerceSimulationService.js';

/** @type {ReturnType<typeof createCommerceContext>|null} */
let sharedCommerce = null;

/** @type {((payload: object) => void)|null} */
let partnerContractFinishedHandler = null;

/**
 * @returns {Promise<object[]>}
 */
async function listCommercializableWindmills() {
  const windmills = await getOrCreateSupplyContext().listWindmillSupplyViews();
  return windmills.filter(
    (windmill) => windmill.isActive && windmill.commercializeEnabled
  );
}

/**
 * @param {object} [deps]
 * @param {LocalStorageCommerceRepository} [deps.commerceRepository]
 * @param {((payload: object) => void)|null} [deps.onPartnerContractFinished]
 * @param {(turn: number) => object} [deps.getTimeInfo]
 */
export function createCommerceContext(deps = {}) {
  const commerceRepository = deps.commerceRepository ?? new LocalStorageCommerceRepository();
  const accounting = getOrCreateAccountingContext();

  const getTimeInfo = deps.getTimeInfo ?? resolveGetTimeInfo();

  const simulationDeps = {
    commerceRepository,
    recordImportExpense: (...args) => accounting.recordImportExpense(...args),
    recordExportIncome: (...args) => accounting.recordExportIncome(...args),
    listCommercializableWindmills,
    getSupplyBuildingRow: (buildingId) =>
      getOrCreateSupplyContext().getSupplyBuildingRow(buildingId),
    updateSupplyBuildingFields: (buildingId, fields) =>
      getOrCreateSupplyContext().updateSupplyBuildingFields(buildingId, fields),
    listWindmillSupplyViews: () => getOrCreateSupplyContext().listWindmillSupplyViews(),
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
