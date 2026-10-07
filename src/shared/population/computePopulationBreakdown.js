import { computeCivilServantCount } from '../../contexts/accounting/domain/policies/ReferenceSalaryPayrollPolicy.js';

/**
 * Partition de la population ville en ensembles disjoints :
 * total = citoyens actifs + fonctionnaires + chômeurs.
 *
 * - Fonctionnaires : floor(total / 12), prélevés sur le pool ouvrier.
 * - Chômeurs       : surplus du pool ouvrier restant après fonctionnaires, hors emplois.
 * - Citoyens actifs: ouvriers employés (ni chômeur, ni fonctionnaire).
 *
 * @param {{ workerPool: number, totalAssigned: number }} params
 * @returns {{
 *   totalPopulation: number,
 *   workerPool: number,
 *   civilServantCount: number,
 *   laborPool: number,
 *   activeCitizenCount: number,
 *   activePopulationCount: number,
 *   unemployed: number,
 *   unemploymentPercentage: number,
 * }}
 */
export function computePopulationBreakdown({ workerPool, totalAssigned }) {
  const workers = Math.max(0, workerPool ?? 0);
  const assigned = Math.max(0, totalAssigned ?? 0);
  const totalPopulation = workers;
  const civilServantCount = computeCivilServantCount(totalPopulation);
  const laborPool = Math.max(0, workers - civilServantCount);
  const unemployed = Math.max(0, laborPool - assigned);
  const activeCitizenCount = Math.max(0, laborPool - unemployed);
  const activePopulationCount = activeCitizenCount + civilServantCount;
  const unemploymentPercentage =
    laborPool > 0 ? Math.round((unemployed / laborPool) * 100) : 0;

  return {
    totalPopulation,
    workerPool: workers,
    civilServantCount,
    laborPool,
    activeCitizenCount,
    activePopulationCount,
    unemployed,
    unemploymentPercentage,
  };
}

/**
 * Un foyer, pour sa part de fonctionnaires et de chômeurs : la règle unique que la ville doit partager avec le
 * foyer (HouseholdPublicPayPolicy, HouseResidentsPolicy) — un fonctionnaire pour douze habitants, posé foyer par
 * foyer, jamais un floor sur le total ville (qui en logerait moins). L'accès routier n'intervient pas ici : qu'un
 * habitant soit appariable à un emploi est une question séparée de son statut de chômeur.
 * @param {{ pop: number, workers: number }} params pop : les habitants du foyer ; workers : ceux d'entre eux qui travaillent ce mois
 * @returns {{ civilServants: number, unemployed: number }}
 */
export function computeHouseholdEmploymentStatus({ pop, workers }) {
  if (!Number.isInteger(pop) || pop < 0) throw new Error(`[population] un foyer a un nombre d'habitants, reçu ${pop}`);
  if (!Number.isInteger(workers) || workers < 0) throw new Error(`[population] un foyer a un nombre de travailleurs, reçu ${workers}`);
  const civilServants = computeCivilServantCount(pop);
  if (workers + civilServants > pop) {
    throw new Error(`[population] foyer : ${workers} travailleurs et ${civilServants} fonctionnaires ne logent pas dans ${pop} habitants`);
  }
  return { civilServants, unemployed: pop - civilServants - workers };
}
