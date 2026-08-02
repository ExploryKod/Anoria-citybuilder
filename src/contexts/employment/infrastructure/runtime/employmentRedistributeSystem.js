/**
 * Thin ECS adapter — monthly worker redistribution via Employment BC only.
 * Factory worker demand/allocation is handled by Supply systems (see pipeline order).
 */
export function createEmploymentRedistributeSystem({
  employment,
  getSectorPriorities,
}) {
  return async function employmentRedistribute(_world, context = {}) {
    await employment.distributeCityWorkers({
      sectorPriorities: getSectorPriorities(),
    });
  };
}
