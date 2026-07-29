import { computeCityEmploymentSummary } from '../../domain/computeCityEmploymentSummary.js';

/**
 * Query: single read model for employment presentation (status bar, work-section, icons).
 */
export class GetCityEmploymentSummary {
  /**
   * @param {import('../ports/EmploymentBuildingRepository.js').EmploymentBuildingRepository} employmentBuildingRepository
   */
  constructor(employmentBuildingRepository) {
    this.employmentBuildingRepository = employmentBuildingRepository;
  }

  /**
   * @returns {Promise<ReturnType<typeof computeCityEmploymentSummary>>}
   */
  async execute() {
    const buildings = await this.employmentBuildingRepository.listAllSnapshots();
    return computeCityEmploymentSummary(buildings);
  }
}
