/**
 * Application service — a company the catalog says is liquidated when it cannot pay (`liquidatedWhenInsolvent`: the insurance companies today) is demolished
 * once its debts have stayed open `graceMonths` months in a row (PayableCatalog's INSOLVENCY_GRACE_MONTHS, read with the months by the accounting's
 * `getInsolvency`: derived from the journal, nothing stored). The demolition is the player's own (BulldozeBuildingAtTile): the books are closed first (the liquidation of
 * PLAN_DEMOLITION_LIQUIDATION.md: stock sold, creditors paid by rank, the rest abandoned, the cash back to the city), then the footprint and the row go, and the place
 * of the company is free again. The player is told by an event; the screen reads it (see game.js).
 *
 * A company that cannot be liquidated (its books refuse to close, the demolition is refused) does not stop the others, nor the rest of the day's systems: each failure is
 * reported (the console, and an event the screen shows as an error) and the company is tried again the next month. Nothing is skipped without being said.
 */
export class LiquidateInsolventCompanies {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<object>>} deps.listAllBuildingRows
   * @param {(row: object) => string | null} deps.instanceIdFromHouseRow
   * @param {(type: string) => boolean} deps.isLiquidatedWhenInsolvent the catalog's fact for a building type
   * @param {(instanceId: string) => Promise<{ months: number, graceMonths: number } | null>} deps.getInsolvency
   * @param {(params: { city: object, x: number, y: number, meshInstanceId: string }) => Promise<{ buildingId?: string, refused?: string }>} deps.bulldozeBuildingAtTile
   * @param {() => object | null} deps.getGameCity
   * @param {(row: object) => string} deps.nameOfRow the name of the company, as the catalog gives it
   * @param {(event: { instanceId: string, buildingType: string, name: string, x: number, y: number }) => void} deps.announce
   * @param {(failure: { instanceId: string, buildingType: string, name: string, reason: string }) => void} deps.reportFailure
   */
  constructor(deps) {
    for (const [name, dep] of Object.entries(deps)) {
      if (typeof dep !== 'function') throw new Error(`[insolvency] the service needs its ${name}`);
    }
    this.deps = deps;
  }

  /**
   * @returns {Promise<{ liquidated: Array<{ instanceId: string, name: string }>, failed: Array<{ instanceId: string, name: string, reason: string }> }>}
   */
  async execute() {
    const liquidated = [];
    const failed = [];
    for (const row of await this.deps.listAllBuildingRows()) {
      if (!this.deps.isLiquidatedWhenInsolvent(row.type)) continue;
      const instanceId = this.deps.instanceIdFromHouseRow(row);
      // Reading the debts and naming the company are not the liquidation: an error there is a defect of the game, and it is left to stop loudly instead of being told to the
      // player as a bankruptcy that could not be settled. Only the liquidation itself (below) is reported company by company.
      const insolvency = await this.deps.getInsolvency(instanceId);
      if (!insolvency) throw new Error(`[insolvency] ${row.type} is liquidated when it cannot pay but is no company: its debts cannot be read`);
      if (insolvency.months < insolvency.graceMonths) continue;
      const name = this.deps.nameOfRow(row);
      try {
        const city = this.deps.getGameCity();
        if (!city) throw new Error('there is no city on screen to take the building off');
        const outcome = await this.deps.bulldozeBuildingAtTile({ city, x: row.x, y: row.y, meshInstanceId: instanceId });
        if (outcome.refused) throw new Error(`the demolition was refused (${outcome.refused})`);
        liquidated.push({ instanceId, name });
        this.deps.announce({ instanceId, buildingType: row.type, name, x: row.x, y: row.y });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[insolvency] ${name} (${instanceId}) could not be liquidated, it is tried again next month:`, error);
        failed.push({ instanceId, name, reason });
        this.deps.reportFailure({ instanceId, buildingType: row.type, name, reason });
      }
    }
    return { liquidated, failed };
  }
}
