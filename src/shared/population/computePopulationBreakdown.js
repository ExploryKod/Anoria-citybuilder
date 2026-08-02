import { computeCivilServantCount } from '../../contexts/accounting/domain/policies/ReferenceSalaryPayrollPolicy.js';

/**
 * Partition de la population ville en ensembles disjoints :
 * total = citoyens actifs + élites + fonctionnaires + chômeurs.
 *
 * - Fonctionnaires : floor(total / 12), prélevés sur le pool ouvrier (non élite).
 * - Chômeurs       : surplus du pool ouvrier restant après fonctionnaires, hors emplois.
 * - Citoyens actifs: ouvriers employés (ni chômeur, ni élite, ni fonctionnaire).
 *
 * @param {{ workerPool: number, elitePool: number, totalAssigned: number }} params
 * @returns {{
 *   totalPopulation: number,
 *   workerPool: number,
 *   elitePool: number,
 *   civilServantCount: number,
 *   laborPool: number,
 *   activeCitizenCount: number,
 *   activePopulationCount: number,
 *   unemployed: number,
 *   unemploymentPercentage: number,
 * }}
 */
export function computePopulationBreakdown({ workerPool, elitePool, totalAssigned }) {
  const workers = Math.max(0, workerPool ?? 0);
  const elites = Math.max(0, elitePool ?? 0);
  const assigned = Math.max(0, totalAssigned ?? 0);
  const totalPopulation = workers + elites;
  const civilServantCount = computeCivilServantCount(totalPopulation);
  const laborPool = Math.max(0, workers - civilServantCount);
  const unemployed = Math.max(0, laborPool - assigned);
  const activeCitizenCount = Math.max(0, laborPool - unemployed);
  const activePopulationCount = activeCitizenCount + elites + civilServantCount;
  const unemploymentPercentage =
    laborPool > 0 ? Math.round((unemployed / laborPool) * 100) : 0;

  return {
    totalPopulation,
    workerPool: workers,
    elitePool: elites,
    civilServantCount,
    laborPool,
    activeCitizenCount,
    activePopulationCount,
    unemployed,
    unemploymentPercentage,
  };
}
