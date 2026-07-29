import { factoryMaxStorage, workerProductionPercentage } from './FactoryStoragePolicy.js';

/**
 * @param {object} params
 * @param {number} params.allocatedWorkers
 * @param {number} params.previousStock
 * @param {number} params.currentRawStock
 * @param {number} params.currentOutputStock
 * @param {string} params.storageType - factoryMaxStorage key
 * @param {number} [params.maxWorkersPerProduct=2]
 */
export function computeTransformAmount({
  allocatedWorkers,
  previousStock,
  currentRawStock,
  currentOutputStock,
  storageType,
  maxWorkersPerProduct = 2,
}) {
  if (allocatedWorkers <= 0 || previousStock <= 0) return 0;

  const maxTransformable = Math.floor(
    previousStock * (allocatedWorkers / maxWorkersPerProduct)
  );
  const maxStorage = factoryMaxStorage(storageType);
  const remainingCapacity = Math.max(0, maxStorage - currentOutputStock);

  return Math.min(
    maxTransformable,
    remainingCapacity,
    currentRawStock,
    previousStock
  );
}

/**
 * @param {object} params
 * @param {number} params.allocatedWorkers
 * @param {number} params.currentStock
 * @param {string} params.storageType
 * @param {number} [params.productionPercentage]
 * @param {number} [params.maxWorkersPerProduct=2]
 */
export function effectiveFactoryStorage({
  allocatedWorkers,
  currentStock,
  storageType,
  productionPercentage,
  maxWorkersPerProduct = 2,
}) {
  const pct =
    productionPercentage ??
    workerProductionPercentage(allocatedWorkers, maxWorkersPerProduct);
  const baseMax = factoryMaxStorage(storageType);
  const effectiveMax = Math.floor(baseMax * (pct / 100));
  return Math.max(0, effectiveMax - currentStock);
}
