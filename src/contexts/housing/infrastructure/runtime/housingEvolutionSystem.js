/**
 * Thin ECS adapter — house type evolution via Housing BC.
 */
export function createHousingEvolutionSystem({ housing }) {
  return async function housingEvolution(_world, _context = {}) {
    await housing.evolveAllHouseBuildings();
  };
}
