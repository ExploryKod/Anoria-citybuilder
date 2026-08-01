/** Disaster events that can strike the city. */

/** @type {ReadonlyArray<{ type: string, name: string, cost: number, description: string }>} */
export const DISASTER_EVENTS = Object.freeze([
  {
    type: 'ouragan',
    name: 'Ouragan',
    cost: 150,
    description: 'Un violent ouragan a frappé votre ville !',
  },
  {
    type: 'inondation',
    name: 'Inondation',
    cost: 150,
    description: 'Une inondation a dévasté votre ville !',
  },
]);

/**
 * @param {number} randomValue 0..1
 * @returns {typeof DISASTER_EVENTS[number]}
 */
export function selectDisasterEvent(randomValue = Math.random()) {
  const index = Math.floor(randomValue * DISASTER_EVENTS.length);
  return DISASTER_EVENTS[index];
}
