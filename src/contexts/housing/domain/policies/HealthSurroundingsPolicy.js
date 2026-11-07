import { neighbourSickShareOf, unemployedShareOf, workplaceExposureOf } from '../../../../shared/population/HealthFactorCatalog.js';

/**
 * What a house's surroundings do to each of its citizens, which is not the same for all of them: the unemployment weighs only on the residents who look for a job and have none,
 * and the pollution of the workplaces only on those who work there. The house's own reading (its average over its residents) is what its sheet shows; each citizen's
 * environment is read from his own situation: his `workplaceId` (null: no job) and the pollution of that very workplace.
 */

/**
 * What one citizen's own situation makes of the surroundings.
 * @param {{ id: string, workplaceId: string | null }} citizen
 * @param {number} seeking the residents of his house who look for a job (0 for a house whose residents do not: nobody there is unemployed)
 * @param {{ sick: number, residents: number } | undefined} neighbours the sick and the residents of the houses around
 * @param {ReadonlyMap<string, number>} pollutionByWorkplace the pollution level of each workplace of the hamlet (0 when it exposes to nothing)
 * @returns {{ workplaceExposure: number, neighbourSickShare: number, unemployedShare: number }}
 */
export function surroundingsOfCitizen(citizen, seeking, neighbours, pollutionByWorkplace) {
  const neighbourSickShare = neighbourSickShareOf(neighbours);
  if (citizen.workplaceId === null) {
    return seeking > 0
      ? { workplaceExposure: 0, neighbourSickShare, unemployedShare: 1 }
      : { workplaceExposure: 0, neighbourSickShare, unemployedShare: 0 };
  }
  if (!pollutionByWorkplace.has(citizen.workplaceId)) {
    throw new Error(`[health] citizen ${citizen.id} works at ${citizen.workplaceId}, which is not a workplace of the hamlet`);
  }
  return { workplaceExposure: pollutionByWorkplace.get(citizen.workplaceId), neighbourSickShare, unemployedShare: 0 };
}

/**
 * The reading of a house's surroundings as a whole: the averages over its residents, what its sheet shows.
 * @param {{ pop: number, seeking: number }} house `seeking`: the residents who look for a job
 * @param {{ workers: number, exposure: number } | undefined} workplaces the workers of the house and the sum of the levels of their workplaces
 * @param {{ sick: number, residents: number } | undefined} neighbours the sick and the residents of the houses around
 * @returns {{ workplaceExposure: number, neighbourSickShare: number, unemployedShare: number }}
 */
export function surroundingsOf(house, workplaces, neighbours) {
  return {
    workplaceExposure: workplaceExposureOf(workplaces),
    neighbourSickShare: neighbourSickShareOf(neighbours),
    unemployedShare: unemployedShareOf(house.seeking, workplaces?.workers ?? 0),
  };
}
