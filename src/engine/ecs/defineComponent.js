/**
 * Crée un type de composant identifiable.
 * Un composant ECS = données pures, jamais une classe avec des méthodes.
 *
 * @param {string} name - Nom unique (ex: 'Position', 'RoadAccess')
 * @returns {Readonly<{ name: string }>}
 */
export function defineComponent(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('defineComponent: name must be a non-empty string');
  }
  return Object.freeze({ name });
}
