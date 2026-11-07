import db from '../../../../core/persistence/dexie/db.js';
import { createEmptyStocks } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { isActiveHamletRow } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { houseIsOutsideHealth } from '../../../../shared/population/workforceQueries.js';
import { createHousingBuildingSnapshot } from '../../domain/HousingBuildingSnapshot.js';
import { isResidentialHouseType } from '../../domain/policies/HouseCapacityPolicy.js';
import { normalizeResidentialType } from '../../domain/HouseTypeCatalog.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';
import { footprintFromRecord, footprintOccupiesTile } from '../../../../shared/building-identity/Footprint.js';

/** Housing port adapter — accès direct Dexie (table `houses`). */
export class DexieHousingBuildingRepository {
  /** @param {{ citizens: import('../../../../shared/citizens/DexieCitizenRegistry.js').DexieCitizenRegistry }} deps */
  constructor({ citizens } = {}) {
    if (!citizens) throw new Error('[housing] the repository needs the citizens registry: a house population change moves its citizens');
    this.citizens = citizens;
  }

  #toSnapshot(house) {
    if (!Number.isInteger(house.pop) || house.pop < 0) {
      throw new Error(`[housing] house ${instanceIdFromHouseRow(house)} has no residents count, got ${house.pop}`);
    }
    return createHousingBuildingSnapshot({
      // Passed first so any field this BC doesn't explicitly name (e.g.
      // Supply's `servedFlags`) rides along — the explicit keys below then
      // override with their proper row->snapshot remapping/coercion.
      ...house,
      id: instanceIdFromHouseRow(house),
      type: house.type || '',
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      pop: house.pop,
      level: house.level ?? 1,
      lastPopulationGrowthMonth: house.lastPopulationGrowthMonth ?? null,
      lastFamineDeathMonth: house.lastFamineDeathMonth ?? null,
      lastConsumption: house.lastConsumption ?? null,
      stocks: house.stocks || createEmptyStocks(),
      price: house.price ?? 0,
    });
  }

  /**
   * One transaction for the row and its citizens: a change of `pop` brings the house's citizens to the new count (arrivals drawn,
   * the latest arrivals leave), so the row and the citizens never disagree on disk.
   * @param {string} instanceId
   * @param {Record<string, unknown>} updates
   */
  async #putFields(instanceId, updates) {
    await db.transaction('rw', db.houses, db.citizens, async () => {
      const row = await db.houses.get(instanceId);
      if (!row) throw new Error(`[housing] house ${instanceId} is not in the database: ${Object.keys(updates).join(', ')} cannot be written`);

      const next = { ...row };
      for (const key of Object.keys(updates)) {
        if (updates[key] !== undefined) {
          next[key] = updates[key];
        }
      }

      if (updates.pop !== undefined) {
        await this.citizens.setHousePopulation({ houseId: instanceId, hamletId: row.hamletId, pop: updates.pop });
      }
      await db.houses.put(canonicalizeHouseRecord(next));
    });
  }

  async findById(instanceId) {
    if (!instanceId) return null;
    const row = await db.houses.get(instanceId);
    if (!row) return null;
    return this.#toSnapshot(row);
  }

  async findResidentialAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const rows = await db.houses.toArray();
    const house = rows.find((row) => {
      if (!isActiveHamletRow(row)) return false;
      if (!isResidentialHouseType(normalizeResidentialType(row.type || ''))) {
        return false;
      }
      const footprint = footprintFromRecord(row);
      return footprint && footprintOccupiesTile(footprint, tileX, tileY);
    });
    return house ? this.#toSnapshot(house) : null;
  }

  /**
   * Every residential house of the active hamlet, by each tile of its footprint: the answer of `findResidentialAt` for the whole city from ONE
   * read of the table (asking tile by tile reads the whole table each time).
   * @returns {Promise<Map<string, ReturnType<DexieHousingBuildingRepository['findResidentialHouses']> extends Promise<Array<infer S>> ? S : never>>} keyed `"x,y"`
   */
  async indexResidentialByTile() {
    const rows = await db.houses.toArray();
    const index = new Map();
    for (const row of rows) {
      if (!isActiveHamletRow(row)) continue;
      if (!isResidentialHouseType(normalizeResidentialType(row.type || ''))) continue;
      const footprint = footprintFromRecord(row);
      if (!footprint) continue;
      const snapshot = this.#toSnapshot(row);
      for (const tile of footprint.tiles) index.set(`${tile.x},${tile.y}`, snapshot);
    }
    return index;
  }

  async findResidentialHouses() {
    const rows = await db.houses.toArray();
    return rows
      .filter((row) => isActiveHamletRow(row) && isResidentialHouseType(row.type || ''))
      .map((row) => this.#toSnapshot(row));
  }

  async listAllResidentialSnapshots() {
    return this.findResidentialHouses();
  }

  async savePopulation(instanceId, payload) {
    if (!instanceId) return;
    const fields = { pop: payload.pop };
    if (payload.lastPopulationGrowthMonth !== undefined) {
      fields.lastPopulationGrowthMonth = payload.lastPopulationGrowthMonth;
    }
    if (payload.lastFamineDeathMonth !== undefined) {
      fields.lastFamineDeathMonth = payload.lastFamineDeathMonth;
    }
    await this.#putFields(instanceId, fields);
  }

  /**
   * For each house, how many of its residents work and the sum of the pollution levels of their workplaces: read from the workplaces' `workerSources` (the houses their
   * workers come from) and the `pollution` the catalog gives their type. Housing reads the rows employment writes, as supply does.
   * @returns {Promise<Map<string, { workers: number, exposure: number }>>} only the houses that have workers
   */
  async workplaceExposureByHouse() {
    const byHouse = new Map();
    for (const row of (await db.houses.toArray()).filter(isActiveHamletRow)) {
      const pollution = getBuildingDefinition(row.type)?.employment?.pollution ?? 0;
      for (const [houseId, workers] of Object.entries(row.employees?.workerSources ?? {})) {
        if (!(workers > 0)) continue;
        const known = byHouse.get(houseId) ?? { workers: 0, exposure: 0 };
        known.workers += workers;
        known.exposure += workers * pollution;
        byHouse.set(houseId, known);
      }
    }
    return byHouse;
  }

  /**
   * The pollution level of every workplace of the hamlet that employs (the `pollution` the catalog gives its type, 0 when it exposes to nothing), by workplace id: what a
   * citizen is exposed to is that of the workplace he works at (his `workplaceId`).
   * @returns {Promise<Map<string, number>>}
   */
  async pollutionByWorkplace() {
    const byWorkplace = new Map();
    for (const row of (await db.houses.toArray()).filter(isActiveHamletRow)) {
      if (!(row.employees?.worker_need > 0)) continue;
      byWorkplace.set(instanceIdFromHouseRow(row), getBuildingDefinition(row.type)?.employment?.pollution ?? 0);
    }
    return byWorkplace;
  }

  /**
   * For each residential house, the sick and the residents of the OTHER houses within `radius` tiles (Manhattan, from the anchors): what the contagion spreads from (see
   * HealthFactorCatalog.js). A house that has not been judged yet has no sick known (`sickCount` absent: nobody has been found ill), and an invalid citizen who is not sick
   * is not counted. Every house is in the map, with zeros when nobody lives around.
   * @param {number} radius
   * @returns {Promise<Map<string, { sick: number, residents: number }>>}
   */
  async neighbourSickByHouse(radius) {
    // The houses that stand outside health (the administrators') are neither a source of contagion nor part of the residents it is shared among.
    const houses = (await db.houses.toArray())
      .filter((row) => isActiveHamletRow(row) && isResidentialHouseType(row.type || '') && !houseIsOutsideHealth(row.type))
      .map((row) => ({ id: instanceIdFromHouseRow(row), x: row.x, y: row.y, residents: row.pop, sick: row.sickCount ?? 0 }));
    const byHouse = new Map();
    for (const house of houses) {
      const around = { sick: 0, residents: 0 };
      for (const other of houses) {
        if (other.id === house.id) continue;
        if (Math.abs(other.x - house.x) + Math.abs(other.y - house.y) > radius) continue;
        around.sick += other.sick;
        around.residents += other.residents;
      }
      byHouse.set(house.id, around);
    }
    return byHouse;
  }

  /**
   * Persist a month's health judgement of a house: its citizens' new health and the mark that the month was judged — one transaction.
   * @param {string} instanceId
   * @param {{ citizens: ReadonlyArray<import('../../../../shared/citizens/Citizen.js').Citizen>, monthKey: number }} judgement
   */
  async saveHealthJudgement(instanceId, { citizens, monthKey, sick, invalid, deaths }) {
    // `deaths` are the ids of citizens who died of poor health this month: they leave with the same write that records the health of the others and lowers the house's
    // population, so the row's `pop` and its citizens never disagree. Among the survivors, `invalid` counts those who are invalid and `sick` those under the sick threshold
    // who are not: together they are the ones who cannot work; the pension is paid for the first (a flat share of the benefit base), the sick leave for the second.
    // The caller always says who died (an empty list when nobody did): a judgement written without it would pass for "nobody died".
    if (!Array.isArray(deaths)) throw new Error(`[health] house ${instanceId}: the judgement does not say who died (${deaths})`);
    const dying = new Set(deaths);
    const dead = citizens.filter((citizen) => dying.has(citizen.id));
    if (dead.length !== dying.size) throw new Error(`[health] house ${instanceId}: ${dying.size} deaths named but only ${dead.length} of them live there`);
    const survivors = citizens.filter((citizen) => !dying.has(citizen.id));
    if (!Number.isInteger(sick) || sick < 0 || !Number.isInteger(invalid) || invalid < 0 || sick + invalid > survivors.length) {
      throw new Error(`[health] house ${instanceId}: ${sick} sick and ${invalid} invalid among ${survivors.length} citizens`);
    }
    await db.transaction('rw', db.houses, db.citizens, async () => {
      const row = await db.houses.get(instanceId);
      if (!row) throw new Error(`[health] house ${instanceId} is not in the hamlet: its health cannot be saved`);
      await this.citizens.updateHealth(survivors);
      await this.citizens.remove(dead);
      await db.houses.put(canonicalizeHouseRecord({ ...row, pop: row.pop - dead.length, lastHealthMonth: monthKey, sickCount: sick, invalidCount: invalid }));
    });
  }

  /** Persist the crises of a house (what made inhabitants leave, see RunMonthlyDepartures.js) with its population after the departures. */
  async saveDepartures(instanceId, { departures, repopulationBans, pop }) {
    if (!instanceId) return;
    await this.#putFields(instanceId, { departures, repopulationBans, pop });
  }

  /**
   * Persist a level change (1 <-> 2) for a Blue/Red/Purple house. The house `type` (color) never changes here — only
   * `level` and `pop` (see `HouseLevelPolicy`).
   *
   * @param {object} params
   * @param {string} params.houseId
   * @param {1 | 2} params.targetLevel
   * @param {number} params.targetPop
   */
  async applyLevelChange({ houseId, targetLevel, targetPop }) {
    await this.#putFields(houseId, {
      level: targetLevel,
      pop: targetPop,
    });
  }
}
