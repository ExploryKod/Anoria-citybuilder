/**
 * Application service — a company the catalog says is liquidated when it cannot pay (`liquidatedWhenInsolvent`: the insurance companies today) is demolished
 * once its debts have stayed open `graceMonths` months in a row (PayableCatalog's INSOLVENCY_GRACE_MONTHS, read with the months by the accounting's
 * `getInsolvency`: derived from the journal, nothing stored). The demolition is the player's own (BulldozeBuildingAtTile): the books are closed first (the liquidation of
 * PLAN_DEMOLITION_LIQUIDATION.md: stock sold, creditors paid by rank, the rest abandoned, the cash back to the city), then the footprint and the row go, and the place
 * of the company is free again. The player is told by an event; the screen reads it (see game.js).
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
   */
  constructor(deps) {
    for (const [name, dep] of Object.entries(deps)) {
      if (typeof dep !== 'function') throw new Error(`[insolvency] the service needs its ${name}`);
    }
    this.deps = deps;
  }

  /**
   * @returns {Promise<Array<{ instanceId: string, name: string }>>} the companies liquidated
   */
  async execute() {
    const city = this.deps.getGameCity();
    const liquidated = [];
    for (const row of await this.deps.listAllBuildingRows()) {
      if (!this.deps.isLiquidatedWhenInsolvent(row.type)) continue;
      const instanceId = this.deps.instanceIdFromHouseRow(row);
      const insolvency = await this.deps.getInsolvency(instanceId);
      if (!insolvency) throw new Error(`[insolvency] ${row.type} ${instanceId} is liquidated when it cannot pay but is no company: its debts cannot be read`);
      if (insolvency.months < insolvency.graceMonths) continue;
      // A company is liquidated where it stands: with no city to take it off, it is left (the next month tries again), never half removed.
      if (!city) continue;
      const name = this.deps.nameOfRow(row);
      const outcome = await this.deps.bulldozeBuildingAtTile({ city, x: row.x, y: row.y, meshInstanceId: instanceId });
      if (outcome.refused) throw new Error(`[insolvency] ${name} (${instanceId}) cannot be liquidated: the demolition was refused (${outcome.refused})`);
      liquidated.push({ instanceId, name });
      this.deps.announce({ instanceId, buildingType: row.type, name, x: row.x, y: row.y });
    }
    return liquidated;
  }
}
