/** @typedef {(logicalId: string, x: number, y: number, options?: object) => import('./SceneTilePort.js').SceneTilePort} SceneTileFactory */

/** @type {Array<{ match: (logicalId: string) => boolean, create: SceneTileFactory }>} */
const factories = [];

/**
 * @param {(logicalId: string) => boolean} match
 * @param {SceneTileFactory} create
 */
export function registerSceneObjectFactory(match, create) {
  factories.push({ match, create });
}

export function clearSceneObjectFactories() {
  factories.length = 0;
}

/**
 * @param {string} logicalId
 * @param {number} x
 * @param {number} y
 * @param {object} [options]
 * @returns {import('./SceneTilePort.js').SceneTilePort}
 */
export function createSceneTile(logicalId, x, y, options = {}) {
  const entry = factories.find((factory) => factory.match(logicalId));
  if (!entry) {
    throw new Error(`[SceneObjectRegistry] No factory for: ${logicalId}`);
  }
  return entry.create(logicalId, x, y, options);
}
