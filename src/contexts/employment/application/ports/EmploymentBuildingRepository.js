/**
 * Port: persistence for employment-relevant building fields.
 */
export class EmploymentBuildingRepository {
  /** Houses that can supply labor (caller filters road access in use case). */
  async listLaborSources() {
    throw new Error('EmploymentBuildingRepository: port not implemented');
  }

  /** Buildings that can employ workers (caller filters road / need). */
  async listWorkplaces() {
    throw new Error('EmploymentBuildingRepository: port not implemented');
  }

  /** Reset all workplace `worker` counts to 0 (preserve workerNeed / sector). */
  async resetWorkplaceWorkers() {
    throw new Error('EmploymentBuildingRepository: port not implemented');
  }

  /**
   * Persist assigned worker count for a workplace.
   * @param {string} buildingId
   * @param {number} workerCount
   */
  async saveWorkers(_buildingId, _workerCount) {
    throw new Error('EmploymentBuildingRepository: port not implemented');
  }

  /** All buildings as employment snapshots (single IndexedDB read). */
  async listAllSnapshots() {
    throw new Error('EmploymentBuildingRepository: port not implemented');
  }
}
