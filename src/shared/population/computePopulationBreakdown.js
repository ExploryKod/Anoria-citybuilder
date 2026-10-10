/**
 * Partition de la population ville en ensembles disjoints :
 * total = citoyens actifs + chômeurs.
 *
 * Civil servants were removed (2026-10-10, "suppress it for now") — a resident is either a worker or
 * unemployed, nothing in between.
 *
 * - Chômeurs       : surplus du pool ouvrier après affectation, hors emplois.
 * - Citoyens actifs: ouvriers employés (pas chômeurs).
 *
 * @param {{ workerPool: number, totalAssigned: number }} params
 * @returns {{
 *   totalPopulation: number,
 *   workerPool: number,
 *   activeCitizenCount: number,
 *   unemployed: number,
 *   unemploymentPercentage: number,
 * }}
 */
export function computePopulationBreakdown({ workerPool, totalAssigned }) {
  const workers = Math.max(0, workerPool ?? 0);
  const assigned = Math.max(0, totalAssigned ?? 0);
  const totalPopulation = workers;
  const unemployed = Math.max(0, totalPopulation - assigned);
  const activeCitizenCount = Math.max(0, totalPopulation - unemployed);
  const unemploymentPercentage =
    totalPopulation > 0 ? Math.round((unemployed / totalPopulation) * 100) : 0;

  return {
    totalPopulation,
    workerPool: workers,
    activeCitizenCount,
    unemployed,
    unemploymentPercentage,
  };
}

/**
 * Un foyer, pour sa part de chômeurs : la règle unique que la ville doit partager avec le foyer
 * (HouseholdPublicPayPolicy, HouseResidentsPolicy). L'accès routier n'intervient pas ici : qu'un habitant
 * soit appariable à un emploi est une question séparée de son statut de chômeur.
 * @param {{ pop: number, workers: number }} params pop : les habitants du foyer ; workers : ceux d'entre eux qui travaillent ce mois
 * @returns {{ unemployed: number }}
 */
export function computeHouseholdEmploymentStatus({ pop, workers }) {
  if (!Number.isInteger(pop) || pop < 0) throw new Error(`[population] un foyer a un nombre d'habitants, reçu ${pop}`);
  if (!Number.isInteger(workers) || workers < 0) throw new Error(`[population] un foyer a un nombre de travailleurs, reçu ${workers}`);
  if (workers > pop) {
    throw new Error(`[population] foyer : ${workers} travailleurs ne logent pas dans ${pop} habitants`);
  }
  return { unemployed: pop - workers };
}
