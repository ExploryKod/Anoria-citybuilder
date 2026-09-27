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
