import { reconcileLots, addToLot, takeFromLots } from '../../domain/policies/HubLotsPolicy.js';
import { availableToClient, allocateToClient } from '../../domain/policies/HubClientAllocationPolicy.js';
import { recordClientDemand, othersWanted } from '../../domain/policies/HubClientDemandPolicy.js';
import { resolveClientPriorities } from '../../../../shared/building-catalog/clientQueries.js';

/**
 * How a hub serves its clients: what each client type may take of a good given who delivered it (the producer
 * type's priorities) and who else is waiting, and the bookkeeping that keeps that true (lots by provenance,
 * what each client wanted). The stock itself is still written by whoever moves it; this only says how much
 * and from which lots, and keeps the breakdown in step.
 */
export class HubServing {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {object} [options]
   * @param {() => Record<string, { order?: string[], disabled?: string[] }>} [options.loadSettings] The player's
   *   saved priorities per producer type; none saved means the catalog's defaults.
   */
  constructor(supplyBuildingRepository, { loadSettings = () => ({}) } = {}) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.loadSettings = loadSettings;
  }

  #priorityOf() {
    const settings = this.loadSettings() ?? {};
    return (producerType) => resolveClientPriorities(producerType, settings[producerType]);
  }

  /** A hub's lots of one good, in step with its stock. */
  lotsOf(hub, category) {
    return reconcileLots(hub.lots?.[category], hub.stocks?.[category] ?? 0);
  }

  /** What a client type can take of a good from this hub at most, right now. */
  availableTo(hub, category, client, turn) {
    return availableToClient({
      lots: this.lotsOf(hub, category),
      priorityOf: this.#priorityOf(),
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
      priorityOf: this.#priorityOf(),
      othersWanted: othersWanted(hub.clientDemand?.[category], client, turn),
      client,
      want: amount,
    });
    await this.supplyBuildingRepository.updateBuildingFields(hubId, {
      lots: { ...(hub.lots ?? {}), [category]: takeFromLots(lots, takes) },
    });
    return takes;
  }

  /** A hub took goods in: the lot of the producer type that delivered grows. */
  async deposit({ hubId, category, producerType, amount, stockAfter }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) return;
    // The lots as they were before this delivery (against the stock as it was), plus what came in.
    const before = reconcileLots(hub.lots?.[category], Math.max(0, stockAfter - amount));
    await this.supplyBuildingRepository.updateBuildingFields(hubId, {
      lots: { ...(hub.lots ?? {}), [category]: addToLot(before, producerType, amount) },
    });
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
