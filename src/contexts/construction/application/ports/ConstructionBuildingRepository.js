/**
 * Port — persistence for construction workflow (tile lookup + row insert).
 */
export class ConstructionBuildingRepository {
  /** @param {number} x @param {number} y @returns {Promise<object | null>} */
  async findByAnchor(_x, _y) {
    throw new Error('ConstructionBuildingRepository.findByAnchor not implemented');
  }

  /** @param {number} x @param {number} y @returns {Promise<object | null>} */
  async findAtTile(_x, _y) {
    throw new Error('ConstructionBuildingRepository.findAtTile not implemented');
  }

  /** @param {string} instanceId @returns {Promise<object | null>} */
  async findById(_instanceId) {
    throw new Error('ConstructionBuildingRepository.findById not implemented');
  }

  /** @param {object} record @returns {Promise<{ success: boolean, instanceId?: string, error?: string, reason?: string }>} */
  async addRecord(_record) {
    throw new Error('ConstructionBuildingRepository.addRecord not implemented');
  }
}
