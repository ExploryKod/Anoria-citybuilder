/**
 * ECS — publish factory worker demand before Employment.redistribute.
 */
export function createSupplySyncFactoryWorkerDemandSystem({ supply }) {
  return async function supplySyncFactoryWorkerDemand() {
    await supply.syncFactoryWorkerDemandFromCaps();
  };
}

/**
 * ECS — split assigned factory workers across commodity lines after Employment.redistribute.
 */
export function createSupplyAllocateFactoryWorkersSystem({ supply }) {
  return async function supplyAllocateFactoryWorkers() {
    await supply.allocateFactoryWorkersToCommodityLines();
  };
}
