import {
  getAnnualSupplyEntry,
  getResourceRoles,
  getResourceStockShape,
  hasQuantityConsumer,
  isRoadNeedMet,
} from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { isOperational } from '../../domain/policies/OperationalGatePolicy.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';

/**
 * The game turn a time context stands for: the time info the game builds carries the
 * day count as `days`, which is what the accounting journal calls the turn.
 * @param {{ turn?: number, days?: number }} timeInfo
 * @returns {number}
 */
const turnOf = (timeInfo) => timeInfo.turn ?? timeInfo.days ?? 0;

/**
 * Side-effect adapter — records supply chain movements in the traceability log.
 */
export class SupplyTraceability {
  /**
   * @param {object} deps
   * @param {import('../dexie/DexieSupplyTraceabilityRepository.js').DexieSupplyTraceabilityRepository} deps.foodTraceabilityRepository
   * @param {import('../../application/ports/SupplyBuildingRepository.js').SupplyBuildingRepository} deps.supplyBuildingRepository
   */
  constructor({ foodTraceabilityRepository, supplyBuildingRepository }) {
    this.traceabilityRepository = foodTraceabilityRepository;
    this.supplyBuildingRepository = supplyBuildingRepository;
    /** Last logged state of each building, as text — a row is written only when it changes. */
    this.lastLoggedStates = new Map();
    this.lastLoggedTurn = -1;
    this.lastLoggedEmployment = null;
  }

  /**
   * @param {object} timeInfo
   * @param {string} distributorId
   * @param {object[]} transfers
   */
  async recordHubToDistributorTransfers(timeInfo, distributorId, transfers = []) {
    if (transfers.length === 0) return;

    const distributorData = await this.supplyBuildingRepository.findRowById(distributorId);
    if (!distributorData) return;

    for (const transfer of transfers) {
      const hubData = await this.supplyBuildingRepository.findRowById(transfer.hubId);
      if (!hubData) continue;

      await this.traceabilityRepository.recordSourceToDistributor(
        turnOf(timeInfo),
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: transfer.hubId,
          x: hubData.x,
          y: hubData.y,
          type: hubData.type,
        },
        {
          id: distributorId,
          x: distributorData.x,
          y: distributorData.y,
          type: distributorData.type,
        },
        transfer.category,
        transfer.amount,
        1
      );
    }
  }

  /**
   * @param {object} timeInfo
   * @param {string} distributorId
   * @param {object[]} transfers
   */
  async recordSourceToDistributorTransfers(timeInfo, distributorId, transfers = []) {
    if (transfers.length === 0) return;

    const distributorData = await this.supplyBuildingRepository.findRowById(distributorId);
    if (!distributorData) return;

    for (const transfer of transfers) {
      const sourceData = await this.supplyBuildingRepository.findRowById(transfer.sourceId);
      if (!sourceData) continue;

      await this.traceabilityRepository.recordSourceToDistributor(
        turnOf(timeInfo),
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: transfer.sourceId,
          x: sourceData.x,
          y: sourceData.y,
          type: sourceData.type,
        },
        {
          id: distributorId,
          x: distributorData.x,
          y: distributorData.y,
          type: distributorData.type,
        },
        transfer.category,
        transfer.amount,
        1
      );
    }
  }

  /**
   * @param {object} timeInfo
   * @param {string} distributorId
   * @param {object[]} transfers
   */
  async recordDistributorToConsumerTransfers(timeInfo, distributorId, transfers = []) {
    if (transfers.length === 0) return;

    const distributorData = await this.supplyBuildingRepository.findRowById(distributorId);
    if (!distributorData) return;

    // A service rides the same chain as a good (a chapel's "basket" of faith), so it is
    // logged like one — from the building that distributes it, which is not always a market.
    for (const transfer of transfers) {
      const houseData = await this.supplyBuildingRepository.findRowById(transfer.houseId);
      if (!houseData) continue;

      await this.traceabilityRepository.recordDistributorToConsumer(
        turnOf(timeInfo),
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        {
          id: distributorId,
          x: distributorData.x,
          y: distributorData.y,
          type: distributorData.type,
        },
        {
          id: transfer.houseId,
          x: houseData.x,
          y: houseData.y,
          type: houseData.type,
        },
        transfer.category,
        transfer.amount,
        1
      );
    }
  }

  /**
   * @param {object} timeInfo
   * @param {object[]} consumptions
   */
  async recordHouseConsumptions(timeInfo, consumptions = []) {
    if (consumptions.length === 0) return;

    for (const entry of consumptions) {
      if (!(entry.taken > 0)) continue;

      const houseData = await this.supplyBuildingRepository.findRowById(entry.houseId);
      if (!houseData) continue;

      const houseRef = {
        id: entry.houseId,
        x: houseData.x,
        y: houseData.y,
        type: houseData.type,
      };

      await this.traceabilityRepository.recordHouseConsumption(
        turnOf(timeInfo),
        timeInfo.monthIndex,
        timeInfo.year || 0,
        houseRef,
        getResourceStockShape().totalKey,
        entry.taken,
        entry.pop
      );
    }
  }

  /**
   * Logs whether each building of the harvest chain — the annual producers
   * (farms) and the hubs that buy from them — can work on this monthly tick.
   * This is the state the traceability panel shows per month, faithful to the
   * game: a building deleted later still shows as it was.
   * @param {object} timeInfo
   */
  async recordChainStates(timeInfo) {
    const [producers, hubs] = await Promise.all([
      this.supplyBuildingRepository.findByResourceRole('producer'),
      this.supplyBuildingRepository.findByResourceRole('hub'),
    ]);
    const chain = [
      ...producers.map((building) => ({ building, category: getAnnualSupplyEntry(building.type)?.categories[0] })),
      ...hubs.map((building) => ({ building, category: getResourceRoles(building.type).find((entry) => entry.role === 'hub')?.categories[0] })),
    ].filter(({ category }) => category);

    for (const { building, category } of chain) {
      await this.traceabilityRepository.recordChainState(
        turnOf(timeInfo),
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        { id: building.id, x: building.x, y: building.y, type: building.type },
        category,
        isOperational({
          type: building.type,
          roadCount: building.roadCount,
          worker: building.worker,
          workerNeed: building.workerNeed,
        })
          ? 1
          : 0
      );
    }
  }

  /**
   * Logs the inhabitants of every house on this monthly tick, so the panel
   * shows the population each past month really had (not today's).
   * @param {object} timeInfo
   */
  async recordPopulationStates(timeInfo) {
    const consumers = await this.supplyBuildingRepository.findByResourceRole('consumer');
    const { totalKey } = getResourceStockShape();

    for (const building of consumers) {
      if (!hasQuantityConsumer(building.type)) continue;
      await this.traceabilityRepository.recordPopulationState(
        turnOf(timeInfo),
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        { id: building.id, x: building.x, y: building.y, type: building.type },
        totalKey,
        Number.isFinite(building.pop) ? Math.max(0, Math.floor(building.pop)) : 0
      );
    }
  }

  /**
   * Logs each harvest a hub bought from a producer, on the turn of the sale —
   * and, for every annual producer no hub bought from on a collection turn,
   * why not. The cause is what a player can act on: no road, nothing
   * harvested (unstaffed during the season), a hub with no room left, or a
   * hub that cannot work.
   * @param {object} timeInfo
   * @param {Array<{ hubId?: string, collected?: boolean, reason?: string, transfers?: Array<{ sourceId: string, category: string, amount: number }> }>} hubResults
   */
  async recordHarvestSales(timeInfo, hubResults = []) {
    if (hubResults.length === 0) return;
    const turn = turnOf(timeInfo);
    const month = timeInfo.monthIndex || 0;
    const year = timeInfo.year || 0;
    const soldIds = new Set();

    for (const hubResult of hubResults) {
      if (!hubResult?.transfers?.length) continue;
      const hubData = await this.supplyBuildingRepository.findRowById(hubResult.hubId);
      if (!hubData) continue;

      for (const transfer of hubResult.transfers) {
        const sourceData = await this.supplyBuildingRepository.findRowById(transfer.sourceId);
        if (!sourceData) continue;
        soldIds.add(transfer.sourceId);

        await this.traceabilityRepository.recordSourceToHub(
          turn,
          month,
          year,
          { id: transfer.sourceId, x: sourceData.x, y: sourceData.y, type: sourceData.type },
          { id: hubResult.hubId, x: hubData.x, y: hubData.y, type: hubData.type },
          transfer.category,
          transfer.amount
        );
      }
    }

    const anyCollected = hubResults.some((hubResult) => hubResult.collected);
    const hubCause = anyCollected
      ? 'hub_full'
      : hubResults.some((hubResult) => hubResult.reason === 'hub_not_operational')
        ? 'hub_idle'
        : hubResults.some((hubResult) => hubResult.reason === 'hub_full')
          ? 'hub_full'
          : 'unknown';

    const producers = await this.supplyBuildingRepository.findByResourceRole('producer');
    for (const building of producers) {
      const entry = getAnnualSupplyEntry(building.type);
      if (!entry || soldIds.has(building.id)) continue;

      const category = entry.categories[0];
      const cause =
        !isRoadNeedMet(building.type, building.roadCount)
          ? 'no_road'
          : (building.stocks?.[category] ?? 0) <= 0
            ? 'no_workers'
            : hubCause;
      await this.traceabilityRepository.recordSaleMissed(
        turn,
        month,
        year,
        { id: building.id, x: building.x, y: building.y, type: building.type },
        category,
        cause
      );
    }
  }

  /**
   * Logs the full state of every building that stocks, employs or houses — its goods, its
   * staff, its level, its inhabitants — but only when it differs from the last state logged
   * for that building. The panel and the exports rebuild any month from these rows.
   * @param {object} timeInfo
   */
  async recordBuildingStates(timeInfo) {
    const turn = turnOf(timeInfo);
    if (turn < this.lastLoggedTurn) this.lastLoggedStates.clear(); // a new game began
    this.lastLoggedTurn = turn;

    const rows = await this.supplyBuildingRepository.listAllBuildingRows();
    for (const row of rows) {
      const definition = getBuildingDefinition(row.type);
      const isTracked =
        definition?.resourceRoles?.length > 0 ||
        definition?.employment?.workerNeed > 0 ||
        Boolean(definition?.residentialGroup);
      if (!isTracked) continue;

      const id = row.instanceId ?? row.id;
      const state = {
        pop: row.pop ?? 0,
        level: row.level ?? null,
        tier: row.tier ?? null,
        roads: row.roads ?? 0,
        stocks: Object.fromEntries(Object.entries(row.stocks ?? {}).filter(([, amount]) => amount > 0)),
        workers: row.employees?.worker ?? null,
        workerNeed: row.employees?.worker_need ?? null,
        elite: row.employees?.elite ?? null,
        eliteNeed: row.employees?.elite_need ?? null,
        servedFlags: row.servedFlags ?? null,
        lastConsumption: row.lastConsumption ?? null,
      };
      const signature = JSON.stringify(state);
      if (this.lastLoggedStates.get(id) === signature) continue;
      this.lastLoggedStates.set(id, signature);

      await this.traceabilityRepository.recordBuildingState(
        turn,
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        { id, x: row.x, y: row.y, type: row.type },
        state
      );
    }
  }

  /**
   * The city's employment (jobs, unemployed, by social group), logged when it changes.
   * @param {object} timeInfo
   * @param {object} summary What the employment context computes for the city.
   */
  async recordEmploymentSummary(timeInfo, summary) {
    const compact = {
      totalPopulation: summary.totalPopulation,
      laborPool: summary.laborPool,
      totalAssigned: summary.totalAssigned,
      totalNeed: summary.totalNeed,
      unemployed: summary.unemployed,
      unemploymentPercentage: summary.unemploymentPercentage,
      lack: summary.lack,
      byGroup: summary.byGroup,
      bySkill: summary.bySkill,
    };
    const signature = JSON.stringify(compact);
    const turn = turnOf(timeInfo);
    if (turn < this.lastLoggedTurn) this.lastLoggedEmployment = null; // a new game began
    if (signature === this.lastLoggedEmployment) return;
    this.lastLoggedEmployment = signature;

    await this.traceabilityRepository.recordEmploymentSummary(
      turn,
      timeInfo.monthIndex || 0,
      timeInfo.year || 0,
      compact
    );
  }

  /**
   * A building was placed or demolished.
   * @param {object} timeInfo
   * @param {'placed' | 'demolished'} event
   * @param {{ id?: string | null, type: string, x?: number, y?: number }} building
   */
  async recordBuildingEvent(timeInfo, event, building) {
    await this.traceabilityRepository.recordGameEvent(
      turnOf(timeInfo),
      timeInfo.monthIndex || 0,
      timeInfo.year || 0,
      `building_${event}`,
      { id: building.id ?? null, x: building.x, y: building.y, type: building.type },
      1,
      // What it was, by the catalog's own category: a tree and a house are not the same loss
      { category: getBuildingDefinition(building.type)?.construction?.category ?? null }
    );
  }

  /**
   * Houses that went up or down a level (or changed type, for a palace).
   * @param {object} timeInfo
   * @param {Array<{ houseId: string, previousType?: string, targetType?: string, previousLevel?: number, targetLevel?: number, previousPop?: number, targetPop?: number, reason?: string }>} changes
   */
  async recordHouseChanges(timeInfo, changes = []) {
    for (const change of changes) {
      const row = await this.supplyBuildingRepository.findRowById(change.houseId);
      const rose =
        Number.isFinite(change.previousLevel) && Number.isFinite(change.targetLevel)
          ? change.targetLevel > change.previousLevel
          : null;
      await this.traceabilityRepository.recordGameEvent(
        turnOf(timeInfo),
        timeInfo.monthIndex || 0,
        timeInfo.year || 0,
        rose === null ? 'house_type_changed' : rose ? 'house_level_up' : 'house_level_down',
        { id: change.houseId, x: row?.x, y: row?.y, type: row?.type ?? change.targetType },
        change.targetPop ?? 0,
        {
          previousLevel: change.previousLevel,
          targetLevel: change.targetLevel,
          previousType: change.previousType,
          targetType: change.targetType,
          previousPop: change.previousPop,
          targetPop: change.targetPop,
          reason: change.reason,
          unmetRequirements: change.unmetRequirements ?? null,
        }
      );
    }
  }

  /**
   * Inhabitants lost to famine this month.
   * @param {object} timeInfo
   * @param {number} deaths
   */
  async recordFamineDeaths(timeInfo, deaths) {
    if (!(deaths > 0)) return;
    await this.traceabilityRepository.recordGameEvent(
      turnOf(timeInfo),
      timeInfo.monthIndex || 0,
      timeInfo.year || 0,
      'famine_deaths',
      null,
      deaths
    );
  }
}
