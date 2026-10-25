import db from '../../../../core/persistence/dexie/db.js';
import { isActiveHamletRow } from '../../../../core/persistence/hamlet/hamletSession.js';
import { createSupplyBuildingSnapshot } from '../../domain/SupplyBuildingSnapshot.js';
import { createSupplyBuildingView } from '../../domain/SupplyBuildingView.js';
import { createSupplyStock } from '../../domain/value-objects/SupplyStock.js';
import {
  canonicalizeHouseRecord,
  instanceIdFromHouseRow,
} from '../../../../shared/building-identity/index.js';
import { getNaturalResourceKind } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import {
  hasResourceRole,
  getAllCategoriesForRole,
  getMaxStockForBuilding,
} from '../../domain/policies/ResourceRolePolicy.js';

/** Supply port adapter — accès direct Dexie (table `houses`). */
export class DexieSupplyBuildingRepository {
  /**
   * The unit of work in progress (see `inUnitOfWork`), or null. While it lasts, a row is read from the database once and kept here, and what is written is kept
   * as the fields that changed, to be written together at the end.
   * @type {{ rows: Map<string, object | null>, allLoaded: boolean, pending: Map<string, Record<string, unknown>> } | null}
   */
  #session = null;

  /**
   * Runs `work` with the building rows read once and written once. A supply cycle reads and rewrites the same few dozen rows hundreds of times (each read a
   * transaction, each write two): inside a unit of work they are read from memory and what changed is written in one go when `work` ends, even if it threw.
   *
   * The write is made on the row as it is THEN in the database, field by field: a building demolished meanwhile is not written back, and a field another context
   * changed in the meantime is not overwritten. Reads hand out copies, as a read of the database does.
   * @template T
   * @param {() => Promise<T>} work
   * @returns {Promise<T>}
   */
  async inUnitOfWork(work) {
    if (this.#session) return work();
    const session = { rows: new Map(), allLoaded: false, pending: new Map() };
    this.#session = session;
    try {
      return await work();
    } finally {
      try {
        // What `work` left, and what anything running alongside it wrote while the first batch was being written.
        while (session.pending.size > 0) {
          const batch = session.pending;
          session.pending = new Map();
          await this.#flush(batch);
        }
      } finally {
        this.#session = null;
      }
    }
  }

  /** @param {Map<string, Record<string, unknown>>} pending the fields changed per building */
  async #flush(pending) {
    await db.transaction('rw', db.houses, async () => {
      const ids = [...pending.keys()];
      const current = await db.houses.bulkGet(ids);
      const puts = [];
      ids.forEach((id, index) => {
        // Gone since (demolished, destroyed): not written back.
        if (!current[index]) return;
        puts.push(canonicalizeHouseRecord({ ...current[index], ...pending.get(id) }));
      });
      await db.houses.bulkPut(puts);
    });
  }

  /** A copy of the stored row of a building (what a read of the database gives), or undefined when there is none. */
  async #getRow(id) {
    const session = this.#session;
    if (!session) return db.houses.get(id);
    if (!session.rows.has(id)) session.rows.set(id, (await db.houses.get(id)) ?? null);
    const row = session.rows.get(id);
    return row ? structuredClone(row) : undefined;
  }

  /** Copies of every stored row. */
  async #allRows() {
    const session = this.#session;
    if (!session) return db.houses.toArray();
    if (!session.allLoaded) {
      for (const row of await db.houses.toArray()) {
        // A row already held keeps what this unit of work has done to it.
        if (!session.rows.has(row.instanceId)) session.rows.set(row.instanceId, row);
      }
      session.allLoaded = true;
    }
    return [...session.rows.values()].filter(Boolean).map((row) => structuredClone(row));
  }

  async #activeRows() {
    const rows = await this.#allRows();
    return rows.filter(isActiveHamletRow);
  }

  #toSnapshot(house) {
    const employees = house.employees || {};
    const type = house.type || '';
    return createSupplyBuildingSnapshot({
      // Passed first so any catalog-declared field (e.g. a periodLock's
      // `field` name) rides along unnamed — the explicit keys below then
      // override with their proper row->snapshot remapping/coercion.
      ...house,
      id: instanceIdFromHouseRow(house),
      type,
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      stocks: house.stocks || {},
      // The catalog is the only source of a stock ceiling — a stored row value never overrides it.
      maxStock: getMaxStockForBuilding(type),
      worker: employees.worker ?? 0,
      workerNeed: employees.worker_need ?? 0,
      lastProductionYear: house.lastProductionYear ?? null,
      lastConsumptionMonth: house.lastConsumptionMonth ?? null,
      lastConsumption: house.lastConsumption ?? null,
      pop: house.pop ?? 0,
      level: house.level ?? 1,
      supplyHubId: house.supplyHubId ?? null,
      linkedDistributors: house.linkedDistributors ?? [],
    });
  }

  #toView(house) {
    const type = house.type || '';
    return createSupplyBuildingView({
      id: instanceIdFromHouseRow(house),
      type,
      x: house.x ?? null,
      y: house.y ?? null,
      roadCount: house.roads ?? 0,
      stocks: house.stocks || {},
      // The catalog is the only source of a stock ceiling — a stored row value never overrides it.
      maxStock: getMaxStockForBuilding(type),
      pop: house.pop ?? 0,
      isBuying: house.isBuying === true,
      noSourcesNearby: house.noSourcesNearby === true,
      distributorTooFar: house.distributorTooFar === true,
      isCollecting: house.isCollecting === true,
      collectedByHub: house.collectedByHub === true,
      lastCollection: house.lastCollection ?? null,
      lastTransaction: house.lastTransaction ?? null,
      unmetDemand: house.unmetDemand ?? 0,
      lastFailedSale: house.lastFailedSale ?? null,
      activityShortfall: house.activityShortfall ?? null,
      lastImport: house.lastImport ?? null,
      lastImportDetails: house.lastImportDetails ?? null,
      salesToDistributor: house.salesToDistributor || [],
      salesToHub: house.salesToHub || [],
      isActive: house.isActive !== false,
      commercializeEnabled: house.commercializeEnabled !== false,
      supplyHubId: house.supplyHubId ?? null,
      linkedDistributors: house.linkedDistributors ?? [],
      cycleState: house.cycleState ?? null,
    });
  }

  /**
   * @param {string} instanceId
   * @param {Record<string, unknown>} updates
   */
  async #putFields(instanceId, updates) {
    const session = this.#session;
    if (session) {
      if (!session.rows.has(instanceId)) session.rows.set(instanceId, (await db.houses.get(instanceId)) ?? null);
      const held = session.rows.get(instanceId);
      if (!held) return;
      // Copied: the caller may go on changing what it passed, and the write must be what it passed now.
      const changed = structuredClone(Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)));
      session.rows.set(instanceId, { ...held, ...changed });
      session.pending.set(instanceId, { ...(session.pending.get(instanceId) ?? {}), ...changed });
      return;
    }

    const row = await db.houses.get(instanceId);
    if (!row) return;

    const next = { ...row };
    for (const key of Object.keys(updates)) {
      if (updates[key] !== undefined) {
        next[key] = updates[key];
      }
    }

    await db.houses.put(canonicalizeHouseRecord(next));
  }

  async findById(buildingId) {
    if (!buildingId) return null;
    const row = await this.#getRow(buildingId);
    if (!row) return null;
    return this.#toSnapshot(row);
  }

  async findSupplyView(buildingId) {
    if (!buildingId) return null;
    const row = await this.#getRow(buildingId);
    if (!row) return null;
    return this.#toView(row);
  }

  async listAllSupplyViews() {
    const rows = await this.#activeRows();
    return rows.map((row) => this.#toView(row));
  }

  /** The raw house rows of the active hamlet, for the traceability log of building states. */
  async listAllBuildingRows() {
    return this.#activeRows();
  }

  /**
   * A write names only the goods it moved: whatever else the row holds (the market's food while goods
   * move, and the reverse) is kept as it was.
   */
  async saveStocks(buildingId, stocks) {
    const row = await this.#getRow(buildingId);
    await this.#putFields(buildingId, { stocks: createSupplyStock({ ...(row?.stocks ?? {}), ...stocks }) });
  }

  async saveHubLastCollection(hubId, lastCollection) {
    await this.#putFields(hubId, { lastCollection });
  }

  async recordSourceSaleToHub(sourceId, { year, productType, quantity, hubId }) {
    const sourceData = await this.#getRow(sourceId);
    if (!sourceData) return;

    const salesToDistributor = sourceData.salesToDistributor || [];
    const salesToHub = sourceData.salesToHub || [];
    const currentYear = Number.isFinite(year) ? Math.floor(year) : 0;

    const existingSaleIndex = salesToHub.findIndex(
      (sale) => sale.year === currentYear && sale.productType === productType
    );

    if (existingSaleIndex >= 0) {
      salesToHub[existingSaleIndex].quantity += quantity;
      salesToHub[existingSaleIndex].count += 1;
    } else {
      salesToHub.push({
        year: currentYear,
        productType,
        quantity,
        count: 1,
        hubId,
      });
    }

    const filteredSales = salesToHub.filter((sale) => sale.year === currentYear);

    await this.#putFields(sourceId, {
      salesToDistributor,
      salesToHub: filteredSales,
    });
  }

  async resetSourceSalesForYear(currentYear) {
    const year = Number.isFinite(currentYear) ? Math.floor(currentYear) : 0;
    const rows = await this.#activeRows();
    const sources = rows.filter((row) => hasResourceRole(row.type, 'producer'));

    for (const source of sources) {
      const sourceId = instanceIdFromHouseRow(source);
      const sourceData = await this.#getRow(sourceId);
      if (!sourceData) continue;

      const salesToDistributor = (sourceData.salesToDistributor || []).filter(
        (sale) => sale.year === year
      );
      const salesToHub = (sourceData.salesToHub || []).filter(
        (sale) => sale.year === year
      );

      await this.#putFields(sourceId, {
        salesToDistributor,
        salesToHub,
      });
    }
  }

  async saveSupplyFlags(buildingId, flags) {
    await this.#putFields(buildingId, flags);
  }

  /**
   * @param {string} distributorId
   * @param {string | null} hubId
   * @param {string} linkField The row field the catalog names for this link (`hubLink.sourceLinkField`).
   */
  async saveDistributorHubId(distributorId, hubId, linkField) {
    if (!linkField) throw new Error('[saveDistributorHubId] the link field (hubLink.sourceLinkField) is required');
    await this.#putFields(distributorId, { [linkField]: hubId || null });
  }

  async saveHubLinkedDistributors(hubId, linkedDistributors) {
    const producerCategories = getAllCategoriesForRole('producer');
    await this.#putFields(hubId, {
      linkedDistributors: Array.isArray(linkedDistributors)
        ? linkedDistributors.map((entry) => ({
            distributorId: entry.distributorId,
            x: entry.x,
            y: entry.y,
            allocatedStocks: Object.fromEntries(
              producerCategories.map((category) => [
                category,
                Math.max(0, Math.floor(entry.allocatedStocks?.[category] ?? 0)),
              ])
            ),
          }))
        : [],
    });
  }

  async findRowById(buildingId) {
    if (!buildingId) return null;
    return this.#getRow(buildingId);
  }

  async updateBuildingFields(buildingId, fields) {
    await this.#putFields(buildingId, fields);
  }

  async findByResourceRole(role, categories) {
    const rows = await this.#activeRows();
    return rows
      .filter((row) => hasResourceRole(row.type, role, categories))
      .map((row) => this.#toSnapshot(row));
  }

  async listNatureItems() {
    const rows = await this.#activeRows();
    return rows.filter((row) => (row.category || '') === 'nature');
  }

  async listNaturalResources() {
    const rows = await this.#activeRows();
    return rows
      .filter((row) => getNaturalResourceKind(row.type) && row.x != null && row.y != null)
      .map((row) => ({ id: instanceIdFromHouseRow(row), type: row.type, x: row.x, y: row.y }));
  }

  async listAllBuildingRows() {
    return this.#activeRows();
  }

  async findBuildingRow(buildingId) {
    if (!buildingId) return null;
    return this.#getRow(buildingId);
  }

  async recordSourceSaleToDistributor(sourceId, sale) {
    const sourceData = await this.#getRow(sourceId);
    if (!sourceData) return;

    const salesToDistributor = sourceData.salesToDistributor || [];
    const salesToHub = sourceData.salesToHub || [];
    const currentYear = sale.year ?? 0;

    salesToDistributor.push({
      year: currentYear,
      month: sale.month ?? 0,
      monthName: sale.monthName || '',
      turn: sale.turn ?? 0,
      productType: sale.productType,
      quantity: sale.quantity,
      distributorId: sale.distributorId,
    });

    const filteredSales = salesToDistributor.filter((entry) => entry.year === currentYear);

    await this.#putFields(sourceId, {
      salesToDistributor: filteredSales,
      salesToHub,
    });
  }
}
