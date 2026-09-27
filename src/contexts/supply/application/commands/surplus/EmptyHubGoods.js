import { rankHubDestinations } from '../../../domain/policies/HubDestinationPolicy.js';
import { listHubEmptyProductIds, normalizeHubStorageOrders } from '../../../domain/policies/HubStorageOrdersPolicy.js';
import { getCategoriesForRole, getRoleEntry, getTotalKeyForRole } from '../../../domain/policies/ResourceRolePolicy.js';
import { addCategoryAmount, createResourceStock, takeCategoryAmount } from '../../../domain/value-objects/ResourceStock.js';

/**
 * Command: a hub whose order for a good is "empty" gives that good to the other hubs, a little each tick (the
 * catalog's `emptyRate` on its 'hub' role), to the best destination first (see HubDestinationPolicy). What moves
 * keeps its provenance. When no hub can take it, nothing moves and the order is reported "blocked": the goods stay
 * where they are, nothing is lost. `hubEmptying` on the hub says, per good, whether it is moving or blocked, for the
 * hub's info panel.
 */
export class EmptyHubGoods {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('../../services/HubServing.js').HubServing} hubServing
   */
  constructor(supplyBuildingRepository, hubServing) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.hubServing = hubServing;
  }

  /** @returns {Promise<{ moved: number }>} Units moved this tick. */
  async execute() {
    const hubs = await this.supplyBuildingRepository.findByResourceRole('hub');
    let movedTotal = 0;

    for (const hub of hubs) {
      const productIds = getCategoriesForRole(hub.type, 'hub');
      const orders = normalizeHubStorageOrders(hub.hubStorageOrders, productIds);
      const emptying = {};

      for (const good of listHubEmptyProductIds(orders)) {
        const stock = hub.stocks?.[good] ?? 0;
        if (stock <= 0) continue;

        const rate = getRoleEntry(hub.type, 'hub')?.emptyRate;
        if (!Number.isFinite(rate) || rate <= 0) {
          throw new Error(`[EmptyHubGoods] "${hub.type}" declares no emptyRate on its hub role in buildingEconomy.js`);
        }

        let left = Math.min(stock, rate);
        let moved = 0;
        const others = await this.supplyBuildingRepository.findByResourceRole('hub');
        for (const { hub: destination, room } of rankHubDestinations({ hubs: others, category: good, from: hub, excludeId: hub.id })) {
          const amount = Math.min(left, room);
          if (amount <= 0) continue;
          await this.#move(hub.id, destination.id, good, amount);
          left -= amount;
          moved += amount;
          if (left <= 0) break;
        }

        emptying[good] = moved > 0 ? 'moving' : 'blocked';
        movedTotal += moved;
      }

      if (JSON.stringify(emptying) !== JSON.stringify(hub.hubEmptying ?? {})) {
        await this.supplyBuildingRepository.updateBuildingFields(hub.id, { hubEmptying: emptying });
      }
    }

    return { moved: movedTotal };
  }

  async #move(fromId, toId, good, amount) {
    // The lots first (the receiving hub's are brought in step with the stock it still holds), then both stocks,
    // each under the aggregate its own hub role files the good under.
    await this.hubServing.moveLots({ fromId, toId, category: good, amount });

    const from = await this.supplyBuildingRepository.findById(fromId);
    const to = await this.supplyBuildingRepository.findById(toId);
    const fromCategories = getCategoriesForRole(from.type, 'hub');
    const fromKey = getTotalKeyForRole(from.type, 'hub');
    const toCategories = getCategoriesForRole(to.type, 'hub');
    const toKey = getTotalKeyForRole(to.type, 'hub');

    await this.supplyBuildingRepository.saveStocks(
      fromId,
      takeCategoryAmount(createResourceStock(from.stocks, fromCategories, fromKey), good, amount, fromCategories, fromKey)
    );
    await this.supplyBuildingRepository.saveStocks(
      toId,
      addCategoryAmount(createResourceStock(to.stocks, toCategories, toKey), good, amount, toCategories, toKey)
    );
  }
}
