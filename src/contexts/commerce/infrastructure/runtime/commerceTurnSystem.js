/**
 * Thin ECS adapter — monthly commerce turn via Commerce BC.
 */
export function createCommerceTurnSystem({ commerce }) {
  return async function commerceTurn(_world, context = {}) {
    const city = context.city;
    const time = context.time ?? 0;
    await commerce.simulation.simulate(city, time);
  };
}
