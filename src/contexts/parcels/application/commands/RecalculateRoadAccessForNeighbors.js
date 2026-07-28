/**
 * Recalcule l'accès routier pour une liste de bâtiments (actions joueur ciblées).
 * Délègue à RecalculateRoadAccessForBuilding — pas de changement de règle métier.
 */
export class RecalculateRoadAccessForNeighbors {
  /**
   * @param {import('./RecalculateRoadAccessForBuilding.js').RecalculateRoadAccessForBuilding} recalculateForBuilding
   */
  constructor(recalculateForBuilding) {
    this.recalculateForBuilding = recalculateForBuilding;
  }

  /**
   * @param {Iterable<string>} buildingIds
   * @returns {Promise<{ processed: number, updated: number, results: object[] }>}
   */
  async execute(buildingIds) {
    const unique = [
      ...new Set(
        [...(buildingIds ?? [])].filter((id) => typeof id === 'string' && id.length > 0)
      ),
    ];

    const results = [];
    let updated = 0;

    for (const buildingId of unique) {
      const outcome = await this.recalculateForBuilding.execute(buildingId);
      if (outcome) {
        results.push(outcome);
        if (outcome.updated) updated += 1;
      }
    }

    return {
      processed: unique.length,
      updated,
      results,
    };
  }
}
