import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';

/**
 * Composition orchestration — factory cap edits ripple through Employment then Supply allocation.
 * Presentation calls this instead of crossing BC domain boundaries.
 */
export async function applyFactoryLineCapChanges() {
  const supply = getOrCreateSupplyContext();
  const employment = getOrCreateEmploymentContext();

  await supply.syncFactoryWorkerDemandFromCaps();
  await employment.distributeCityWorkers({
    sectorPriorities: employment.getAllSectorPriorities(),
  });
  await supply.allocateFactoryWorkersToCommodityLines();
}

export async function syncFactoryWorkerDemandFromCaps() {
  return getOrCreateSupplyContext().syncFactoryWorkerDemandFromCaps();
}

export async function allocateFactoryWorkersToCommodityLines() {
  return getOrCreateSupplyContext().allocateFactoryWorkersToCommodityLines();
}
