import { casualtiesAmong, collapseChanceOf, solidityAfterMonth, solidityOf } from '../../../../shared/solidity/SolidityPolicy.js';

/**
 * Application service — each month, the buildings wear and may collapse (docs/gameplay/PLAN_COLLAPSE.md). A building whose upkeep was paid keeps its solidity; one whose
 * upkeep was not (`neglected`, told by the month's settlement) loses a month's wear. A building under the risk threshold then collapses with the chance its bar gives:
 * the people inside who are hit die (counted as accidents), and the building is demolished as the player would (BulldozeBuildingAtTile: a company's books are closed
 * first), which frees the place. The player is told by an event.
 *
 * A collapse that fails (the demolition is refused: the mayor's house, the central bank) does not stop the others, nor the rest of the month: it is reported and tried again
 * next month. Nothing is skipped without being said.
 */
export class WearBuildings {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<object>>} deps.listAllBuildingRows
   * @param {(row: object) => string} deps.instanceIdFromHouseRow
   * @param {(instanceId: string, fields: object) => Promise<void>} deps.updateBuildingFields
   * @param {(row: object) => Promise<Array<{ id: string }>>} deps.citizensInside the people in a building: a house's residents, a workplace's workers
   * @param {(citizens: Array<{ id: string }>) => Promise<void>} deps.killCitizens
   * @param {(count: number) => void} deps.recordAccidentDeaths
   * @param {(params: { city: object, x: number, y: number, meshInstanceId: string }) => Promise<{ buildingId?: string, refused?: string }>} deps.bulldozeBuildingAtTile
   * @param {() => object | null} deps.getGameCity
   * @param {(row: object) => string} deps.nameOfRow
   * @param {() => number} deps.random a draw in [0, 1)
   * @param {(event: { instanceId: string, buildingType: string, name: string, x: number, y: number, deaths: number }) => void} deps.announce
   * @param {(failure: { instanceId: string, buildingType: string, name: string, reason: string }) => void} deps.reportFailure
   */
  constructor(deps) {
    for (const [name, dep] of Object.entries(deps)) {
      if (typeof dep !== 'function') throw new Error(`[collapse] the service needs its ${name}`);
    }
    this.deps = deps;
  }

  /**
   * @param {{ neglected: ReadonlyArray<string> }} params the buildings whose upkeep was not paid this month
   * @returns {Promise<{ collapsed: Array<{ instanceId: string, name: string, deaths: number }>, failed: Array<{ instanceId: string, name: string, reason: string }> }>}
   */
  async execute({ neglected }) {
    if (!Array.isArray(neglected)) throw new Error('[collapse] the buildings whose upkeep was not paid must be told (an empty list when all were)');
    const neglectedIds = new Set(neglected);
    const collapsed = [];
    const failed = [];
    for (const row of await this.deps.listAllBuildingRows()) {
      const before = solidityOf(row);
      if (before === null) continue;
      const instanceId = this.deps.instanceIdFromHouseRow(row);
      const after = solidityAfterMonth({ solidity: before, upkeepPaid: !neglectedIds.has(instanceId) });
      if (after !== before) await this.deps.updateBuildingFields(instanceId, { solidity: after });
      if (!(this.deps.random() < collapseChanceOf(after))) continue;

      const name = this.deps.nameOfRow(row);
      try {
        const city = this.deps.getGameCity();
        if (!city) throw new Error('there is no city on screen to take the building off');
        // Who is hit is drawn before the building goes (a house takes its residents with it), but they die only once it is down: a refused demolition kills nobody.
        const dead = casualtiesAmong({ people: await this.deps.citizensInside(row), random: this.deps.random });
        const outcome = await this.deps.bulldozeBuildingAtTile({ city, x: row.x, y: row.y, meshInstanceId: instanceId });
        if (outcome.refused) throw new Error(`the demolition was refused (${outcome.refused})`);
        await this.deps.killCitizens(dead);
        this.deps.recordAccidentDeaths(dead.length);
        collapsed.push({ instanceId, name, deaths: dead.length });
        this.deps.announce({ instanceId, buildingType: row.type, name, x: row.x, y: row.y, deaths: dead.length });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[collapse] ${name} (${instanceId}) could not be taken down, it is tried again next month:`, error);
        failed.push({ instanceId, name, reason });
        this.deps.reportFailure({ instanceId, buildingType: row.type, name, reason });
      }
    }
    return { collapsed, failed };
  }
}
