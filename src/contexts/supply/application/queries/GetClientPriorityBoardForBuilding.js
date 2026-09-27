import { listClientTypes, producedCategories, resolveInstanceClientPriorities } from '../../../../shared/building-catalog/clientQueries.js';

/**
 * Query: for ONE producer building instance, one priority board PER GOOD it produces — a producer
 * making several goods (a merchant house: dealWood, dealDecoratedPot, dealBook) has one independent
 * ranking per good, since who should get its wood first has nothing to do with who gets its books
 * first. The catalog only says which TYPES are eligible for a given good (`listClientTypes`); which
 * specific instances exist, and the order among them, is this instance's own per-good setting
 * (`clientPriorityByGood[category]` on its own building row) — see resolveInstanceClientPriorities.
 */
export class GetClientPriorityBoardForBuilding {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {string} buildingId
   * @returns {Promise<{
   *   producerId: string,
   *   producerType: string,
   *   goods: Array<{
   *     category: string,
   *     isCustom: boolean,
   *     clients: Array<{ id: string, type: string, x: number, y: number, disabled: boolean, wanted: number, served: number }>,
   *   }>,
   * } | null>} `null` only when the building itself no longer exists. `goods` is empty for a
   *   building with no producer role at all (the Clients tab does not even show for those — see
   *   buildingInfoSharedTabs.js's isVisible — this is the defensive fallback if it is ever called
   *   directly some other way).
   */
  async execute(buildingId) {
    const producer = await this.supplyBuildingRepository.findById(buildingId);
    if (!producer) return null;

    const categories = producedCategories(producer.type);
    if (categories.length === 0) {
      return { producerId: buildingId, producerType: producer.type, goods: [] };
    }

    const rows = await this.supplyBuildingRepository.listAllBuildingRows();
    const savedByGood = producer.clientPriorityByGood ?? {};

    const asked = {};
    for (const [category, byClient] of Object.entries(producer.clientDemand ?? {})) {
      for (const [clientId, entry] of Object.entries(byClient)) {
        asked[`${category}|${clientId}`] = entry;
      }
    }

    const goods = categories.map((category) => {
      const clientTypes = listClientTypes([category]);
      const candidates = rows
        .filter((row) => row.id !== buildingId && clientTypes.includes(row.type))
        .map((row) => ({ id: row.id, type: row.type, x: row.x, y: row.y }));

      const saved = savedByGood[category] ?? null;
      const { order, disabled } = resolveInstanceClientPriorities({
        producerType: producer.type,
        candidates,
        saved,
      });

      const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      return {
        category,
        isCustom: Boolean(saved),
        clients: order
          .filter((id) => byId.has(id))
          .map((id) => {
            const candidate = byId.get(id);
            return {
              id,
              type: candidate.type,
              x: candidate.x,
              y: candidate.y,
              disabled: disabled.includes(id),
              wanted: asked[`${category}|${id}`]?.wanted ?? 0,
              served: asked[`${category}|${id}`]?.served ?? 0,
            };
          }),
      };
    });

    return { producerId: buildingId, producerType: producer.type, goods };
  }
}
