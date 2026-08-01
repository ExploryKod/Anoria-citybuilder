/**
 * Thin ECS adapter — random disaster events via Gameplay BC.
 */
export function createRandomEventsSystem({ gameplay }) {
  return async function randomEvents(_world, context = {}) {
    const city = context.city;
    const time = context.time ?? 0;
    await gameplay.randomEventsSimulation.simulate(city, time);
  };
}
