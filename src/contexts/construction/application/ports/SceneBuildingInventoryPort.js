/**
 * Port — read building types from the live Three.js scene grid (bound each frame).
 */
export class SceneBuildingInventoryPort {
  /** @param {{ city: { size: number }, buildings: object[][] }} _ctx */
  bind(_ctx) {
    throw new Error('SceneBuildingInventoryPort.bind not implemented');
  }

  /** @returns {string[]} */
  listBuildingTypes() {
    throw new Error('SceneBuildingInventoryPort.listBuildingTypes not implemented');
  }
}
