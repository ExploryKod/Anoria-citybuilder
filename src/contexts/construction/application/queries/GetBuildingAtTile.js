/**
 * Query: any building occupying a grid tile (footprint-aware).
 */
export class GetBuildingAtTile {
  /**
   * @param {import('../ports/ConstructionBuildingRepository.js').ConstructionBuildingRepository} repository
   */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * @param {{ x: number, y: number }} params
   * @returns {Promise<object | null>}
   */
  async execute({ x, y }) {
    return this.repository.findAtTile(x, y);
  }
}
