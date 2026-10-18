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
