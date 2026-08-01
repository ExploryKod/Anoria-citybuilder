/**
 * Adapter : inventory building types from the Three.js scene grid.
 * Scan context is bound each frame by scene.update (bindSceneBuildingGrid).
 */
export class SceneBuildingInventoryAdapter {
  constructor() {
    /** @type {{ city: { size: number }, buildings: object[][] } | null} */
    this._ctx = null;
  }

  /**
   * @param {{ city: { size: number }, buildings: object[][] }} ctx
   */
  bind(ctx) {
    this._ctx = ctx?.city && ctx?.buildings ? ctx : null;
  }

  /** @returns {string[]} */
  listBuildingTypes() {
    if (!this._ctx) {
      return [];
    }

    const { city, buildings } = this._ctx;
    /** @type {string[]} */
    const buildingTypes = [];

    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const type = buildings[x]?.[y]?.userData?.type;
        if (type) {
          buildingTypes.push(type);
        }
      }
    }

    return buildingTypes;
  }
}
