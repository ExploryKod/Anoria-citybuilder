import { citizenFirstName } from '../../../../shared/population/CitizenNameCatalog.js';

/**
 * The citizens of one household, one record each: who works where, who is out of work. Derived from the
 * household's residents and the workers each workplace draws from it, so it adds no stored figure: the
 * workers come first (by workplace), then the unemployed. Civil servants were removed from this split
 * (2026-10-10, "suppress it for now") — a resident is either a worker or unemployed, nothing in between.
 *
 * @param {{ houseId: string, pop: number, workplaces: Array<{ workplaceId: string, workers: number }> }} params
 *   workers: the residents of this household who work at that workplace
 * @returns {Array<{ id: string, houseId: string, firstName: string, status: 'worker' | 'unemployed', workplaceId: string | null }>}
 */
export function residentsOfHouse({ houseId, pop, workplaces }) {
  if (!houseId) throw new Error('[residents] a household needs its id');
  if (!Number.isInteger(pop) || pop < 0) throw new Error(`[residents] a household's residents must be a count, got ${pop}`);
  const workers = workplaces.flatMap((entry) => Array.from({ length: entry.workers }, () => entry.workplaceId));
  if (workers.length > pop) throw new Error(`[residents] household ${houseId} has ${workers.length} workers for ${pop} residents`);

  const statuses = [
    ...workers.map((workplaceId) => ({ status: 'worker', workplaceId })),
    ...Array.from({ length: pop - workers.length }, () => ({ status: 'unemployed', workplaceId: null })),
  ];
  return statuses.map((entry, index) => ({
    id: `${houseId}:${index}`,
    houseId,
    firstName: citizenFirstName(houseId, index),
    status: entry.status,
    workplaceId: entry.workplaceId,
  }));
}
