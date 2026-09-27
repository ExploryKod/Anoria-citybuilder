import { reconcileLots, addToLot, takeFromLots, lotOrigin, lotKeyMovedThrough } from '../../domain/policies/HubLotsPolicy.js';
import { availableToClient, allocateToClient } from '../../domain/policies/HubClientAllocationPolicy.js';
import { recordClientDemand, othersWanted } from '../../domain/policies/HubClientDemandPolicy.js';
import { listClientTypes, resolveInstanceClientPriorities } from '../../../../shared/building-catalog/clientQueries.js';

/**
 * How a hub serves its clients: what each client INSTANCE may take of a good given who delivered it (that
 * producer instance's own priorities — see GetClientPriorityBoardForBuilding, set from its own info panel) and
 * who else is waiting, and the bookkeeping that keeps that true (lots by provenance, what each client wanted).
 * The stock itself is still written by whoever moves it; this only says how much and from which lots, and keeps
 * the breakdown in step.
 */
export class HubServing {
  /** @type {Promise<object[]> | null} One fetch shared by every call within a tick — see invalidateCache. */
  #rowsCache = null;

  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * Call once per tick, before any take/availableTo/deposit run (see createSupplyContext.js's
   * runMonthlyResourceCycle). #priorityOf used to call listAllBuildingRows() — a full building-table
   * scan — on EVERY single draw a producer makes from a hub, which for a city with many producers
   * meant dozens of redundant full scans per tick (a real, measured cause of ticks overrunning
   * their own interval). Now one scan is shared by the whole tick; this clears it so the next tick
   * sees fresh data instead of an ever-growing stale snapshot.
   */
  invalidateCache() {
    this.#rowsCache = null;
  }

  /** @returns {Promise<object[]>} */
  #listAllBuildingRowsCached() {
    this.#rowsCache ??= this.supplyBuildingRepository.listAllBuildingRows();
    return this.#rowsCache;
  }

  /**
   * The priority profile of every producer instance a set of lot keys names, FOR ONE GOOD — a
   * producer making several goods ranks each independently (a merchant house's wood clients have
   * nothing to do with its book clients), so the good being served must scope which of its saved
   * rankings applies. Resolved fresh (a producer's own setting, and which client instances
   * currently exist, both change as the game is played) — one building-wide fetch for every lot at
   * once, not one per lot.
   * @param {ReadonlyArray<string>} lotKeys
   * @param {string} category
   * @returns {Promise<(lotKey: string) => { order: string[], disabled: string[] }>}
   */
  async #priorityOf(lotKeys, category) {
    const producerIds = [...new Set(lotKeys.map((key) => lotOrigin(key).producerId).filter(Boolean))];
    if (producerIds.length === 0) return () => ({ order: [], disabled: [] });

    const rows = await this.#listAllBuildingRowsCached();
    const byId = new Map(rows.map((row) => [row.id, row]));
    const clientTypes = listClientTypes([category]);
    const profiles = new Map();
    for (const producerId of producerIds) {
      const producer = byId.get(producerId);
      if (!producer) {
        profiles.set(producerId, { order: [], disabled: [] });
        continue;
      }
      const candidates = rows
        .filter((row) => row.id !== producerId && clientTypes.includes(row.type))
        .map((row) => ({ id: row.id, type: row.type }));
      profiles.set(
        producerId,
        resolveInstanceClientPriorities({
          producerType: producer.type,
          candidates,
          saved: producer.clientPriorityByGood?.[category] ?? null,
        })
      );
    }

    return (lotKey) => profiles.get(lotOrigin(lotKey).producerId) ?? { order: [], disabled: [] };
  }

  /** A hub's lots of one good, in step with its stock. */
  lotsOf(hub, category) {
    return reconcileLots(hub.lots?.[category], hub.stocks?.[category] ?? 0);
  }

  /** What a client instance can take of a good from this hub at most, right now. */
  async availableTo(hub, category, client, turn) {
    const lots = this.lotsOf(hub, category);
    return availableToClient({
      lots,
      priorityOf: await this.#priorityOf(Object.keys(lots), category),
      othersWanted: othersWanted(hub.clientDemand?.[category], client, turn),
      client,
    });
  }

  /**
   * Take `amount` of a good from a hub's lots for a client, and write the lots back. The stock is the
   * caller's to write.
   * @returns {Promise<Array<{ key: string, amount: number }>>} What was taken, per lot.
   */
  async take({ hubId, category, client, amount, turn }) {
    if (!(amount > 0)) return [];
    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) return [];
    const lots = this.lotsOf(hub, category);
    const takes = allocateToClient({
      lots,
      priorityOf: await this.#priorityOf(Object.keys(lots), category),
      othersWanted: othersWanted(hub.clientDemand?.[category], client, turn),
      client,
      want: amount,
    });
    await this.supplyBuildingRepository.updateBuildingFields(hubId, {
      lots: { ...(hub.lots ?? {}), [category]: takeFromLots(lots, takes) },
    });
    return takes;
  }

  /** A hub took goods in: the lot of the producer instance that delivered grows. */
  async deposit({ hubId, category, producerId, amount, stockAfter }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) return;
    // The lots as they were before this delivery (against the stock as it was), plus what came in.
    const before = reconcileLots(hub.lots?.[category], Math.max(0, stockAfter - amount));
    await this.supplyBuildingRepository.updateBuildingFields(hubId, {
      lots: { ...(hub.lots ?? {}), [category]: addToLot(before, producerId, amount) },
    });
  }

  /**
   * Goods move from one hub to another: the lots that carry them move too, so that where the goods came from
   * (and the priorities that go with it) is not lost. Call it BEFORE the stocks are written: the receiving hub's
   * lots are brought in step with the stock it still holds.
   * @returns {Promise<Array<{ key: string, amount: number }>>} What moved, per lot.
   */
  async moveLots({ fromId, toId, category, amount }) {
    const from = await this.supplyBuildingRepository.findById(fromId);
    const to = await this.supplyBuildingRepository.findById(toId);
    if (!from || !to || !(amount > 0)) return [];

    const fromLots = this.lotsOf(from, category);
    const moved = [];
    let left = amount;
    for (const key of Object.keys(fromLots).sort()) {
      const take = Math.min(fromLots[key], left);
      if (take <= 0) continue;
      moved.push({ key, amount: take });
      left -= take;
      if (left <= 0) break;
    }

    let toLots = this.lotsOf(to, category);
    // They arrive told to come through the hub they left: "olive field — warehouse", not just "olive field".
    for (const { key, amount: units } of moved) toLots = addToLot(toLots, lotKeyMovedThrough(key, from.type), units);
    await this.supplyBuildingRepository.updateBuildingFields(fromId, { lots: { ...(from.lots ?? {}), [category]: takeFromLots(fromLots, moved) } });
    await this.supplyBuildingRepository.updateBuildingFields(toId, { lots: { ...(to.lots ?? {}), [category]: toLots } });
    return moved;
  }

  /** Remember what a client wanted of a good and how much it got, for the clients served after it. */
  async recordDemand({ hubId, category, client, turn, wanted, served }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) return;
    await this.supplyBuildingRepository.updateBuildingFields(hubId, {
      clientDemand: {
        ...(hub.clientDemand ?? {}),
        [category]: recordClientDemand(hub.clientDemand?.[category], client, turn, wanted, served),
      },
    });
  }
}
