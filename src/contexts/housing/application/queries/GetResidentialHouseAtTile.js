/**
 * Query: authoritative residential house at a grid tile (after id rename on evolution).
 */
export class GetResidentialHouseAtTile {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   */
  constructor(housingBuildingRepository) {
    this.repository = housingBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {number} params.x
   * @param {number} params.y
   */
  async execute({ x, y }) {
    return this.repository.findResidentialAt(x, y);
  }
}
