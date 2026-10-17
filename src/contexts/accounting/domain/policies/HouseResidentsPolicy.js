import { citizenFirstName } from '../../../../shared/population/CitizenNameCatalog.js';

/**
 * The citizens of one household, one record each: who works where, who is paid by the hamlet, who is out of work. Derived from the
 * household's residents and the workers each workplace draws from it, so it adds no stored figure: the workers come first (by workplace),
 * then the administrators (the residents of a category that looks for no job: the hamlet pays them a stipend, they are never unemployed),
 * then the unemployed. Civil servants were removed from this split (2026-10-10, "suppress it for now").
 *
 * @param {{ houseId: string, pop: number, salaried: number, workplaces: Array<{ workplaceId: string, workers: number }> }} params
 *   workers: the residents of this household who work at that workplace; salaried: the residents the hamlet pays a stipend (the administrators)
 * @returns {Array<{ id: string, houseId: string, firstName: string, status: 'worker' | 'administrator' | 'unemployed', workplaceId: string | null }>}
 */
export function residentsOfHouse({ houseId, pop, salaried, workplaces }) {
  if (!houseId) throw new Error('[residents] a household needs its id');
  if (!Number.isInteger(pop) || pop < 0) throw new Error(`[residents] a household's residents must be a count, got ${pop}`);
  if (!Number.isInteger(salaried) || salaried < 0) throw new Error(`[residents] household ${houseId} needs the count of its salaried residents, got ${salaried}`);
  const workers = workplaces.flatMap((entry) => Array.from({ length: entry.workers }, () => entry.workplaceId));
  if (workers.length + salaried > pop) throw new Error(`[residents] household ${houseId} has ${workers.length} workers and ${salaried} salaried for ${pop} residents (workers)`);

  const statuses = [
    ...workers.map((workplaceId) => ({ status: 'worker', workplaceId })),
    ...Array.from({ length: salaried }, () => ({ status: 'administrator', workplaceId: null })),
    ...Array.from({ length: pop - workers.length - salaried }, () => ({ status: 'unemployed', workplaceId: null })),
  ];
  return statuses.map((entry, index) => ({
    id: `${houseId}:${index}`,
    houseId,
    firstName: citizenFirstName(houseId, index),
    status: entry.status,
    workplaceId: entry.workplaceId,
  }));
}
