/**
 * Query — list building types currently present on the bound scene grid.
 */
export class ListSceneBuildingTypes {
  /**
   * @param {import('../ports/SceneBuildingInventoryPort.js').SceneBuildingInventoryPort} sceneBuildingInventory
   */
  constructor(sceneBuildingInventory) {
    this.sceneBuildingInventory = sceneBuildingInventory;
  }

  /** @returns {string[]} */
  execute() {
    return this.sceneBuildingInventory.listBuildingTypes();
  }
}
