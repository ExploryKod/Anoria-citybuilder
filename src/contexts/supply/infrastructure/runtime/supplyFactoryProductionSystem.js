/**
 * Thin ECS adapter — factory production cycle via Supply BC.
 */
export function createFactoryProductionSystem({ supply }) {
  return async function supplyFactoryProduction(_world, context = {}) {
    const city = context.city;
    const time = context.time ?? 0;
    if (!city) return;

    await supply.runCityFactoryProductionCycle({ city, time });
  };
}
