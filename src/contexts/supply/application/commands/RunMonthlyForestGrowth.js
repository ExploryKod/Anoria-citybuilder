import { monthKeyOf, nextCropStage } from '../../domain/policies/ForestGrowthPolicy.js';
import { getLandUse } from '../../../../shared/land-catalog/LandUseCatalog.js';

/**
 * The forests the producers planted grow, tile by tile, each month: a plant becomes a tree a year on, then a high tree; a tree used up leaves the tile fallow for a
 * month, then a plant is set again (the stages and their delays are the use's `crop`, see LandUseCatalog.js). Each stage is a piece of the map with a record of the hamlet
 * that holds what the tree holds of the owner's resource: the lumberjacks gather from those records like from any tree, and the scene draws the piece the record
 * says (see the sync of the pieces in scene.js). The records and the plots are the only state: nothing is kept of a tree but them.
 */
export class RunMonthlyForestGrowth {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<{ x: number, y: number, use: string, owner: string | null, crop: object | null }>>} deps.listPlots
   * @param {(plots: Array<object>) => Promise<void>} deps.savePlots the whole list as it now stands
   * @param {(x: number, y: number) => Promise<{ id: string, stocks: Record<string, number> } | null>} deps.findRecordAt the record of the tile's tree or plant, if it stands
   * @param {(params: { x: number, y: number, prop: string, stocks: Record<string, number>, groundY: number }) => Promise<void>} deps.createRecord a record with its piece, planted by the owner
   * @param {(recordId: string, params: { prop: string, stocks: Record<string, number> }) => Promise<void>} deps.changeRecord the tree grew: a new piece, a new stock
   * @param {(buyerId: string) => Promise<string | null>} deps.resourceOf what the owner gathers from trees (null when the owner no longer stands)
   */
  constructor(deps) {
    this.deps = deps;
  }

  /** @param {{ year: number, monthIndex: number }} timeInfo the month that ends */
  async execute(timeInfo) {
    const nowKey = monthKeyOf(timeInfo);
    const plots = await this.deps.listPlots();
    let changed = false;
    const next = [];
    for (const plot of plots) {
      const resource = plot.owner === null ? null : await this.deps.resourceOf(plot.owner);
      // Land still for sale, or whose owner is gone, grows nothing
      if (resource === null) { next.push(plot); continue; }
      const record = await this.deps.findRecordAt(plot.x, plot.y);
      const stage = nextCropStage({ use: plot.use, crop: plot.crop, hasRecord: record !== null, nowKey });
      if (stage === null) { next.push(plot); continue; }
      await this.#moveTo(plot, stage, record, resource, getLandUse(plot.use).crop.stages);
      next.push({ ...plot, crop: { stage, since: nowKey } });
      changed = true;
    }
    if (changed) await this.deps.savePlots(next);
  }

  async #moveTo(plot, stage, record, resource, stages) {
    if (stage === 'fallow') return; // the tree's record is already gone: nothing stands
    const yields = stages[stage].yields;
    const stocks = yields === undefined ? {} : { [resource]: yields };
    if (record === null) {
      await this.deps.createRecord({ x: plot.x, y: plot.y, prop: stages[stage].prop, stocks, groundY: plot.groundY });
      return;
    }
    if (stage === 'plant') return; // a plant that lost its piece is simply set again (the record, if any, is kept)
    // A tree that was gathered from keeps what it lost: the high tree holds its 200 less what was taken from the tree
    const taken = Math.max(0, stages.tree.yields - (record.stocks[resource] ?? 0));
    await this.deps.changeRecord(record.id, { prop: stages[stage].prop, stocks: { [resource]: Math.max(0, yields - (stage === 'treeHigh' ? taken : 0)) } });
  }
}
