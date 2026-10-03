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
   * @param {{ listExternalClients?: (category: string) => Array<{ id: string, type: string, label: string }> }} [deps]
   *   `listExternalClients` names candidates that are not a building row — an external trade city
   *   buying a merchant's deal good is a client exactly like a market or workshop is, just not one
   *   the supply repository knows about on its own (see createSupplyContext.js).
   */
  constructor(supplyBuildingRepository, { listExternalClients } = {}) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.listExternalClients = listExternalClients ?? (() => []);
  }

  /**
   * @param {string} buildingId
   * @returns {Promise<{
   *   producerId: string,
   *   producerType: string,
   *   goods: Array<{
   *     category: string,
   *     isCustom: boolean,
   *     hasEligibleClientTypes: boolean,
   *     clients: Array<{ id: string, type: string, x: number|null, y: number|null, label: string|null, disabled: boolean, wanted: number, served: number }>,
   *   }>,
   * } | null>} `null` only when the building itself no longer exists. `goods` is empty for a
   *   building with no producer role at all (the Clients tab does not even show for those — see
   *   buildingInfoSharedTabs.js's isVisible — this is the defensive fallback if it is ever called
   *   directly some other way). A client's `x`/`y` are null and `label` is set for an external
   *   trade-city client (no map position among this city's own buildings); `label` is null and
   *   `x`/`y` are set for a building client (its display name is read from the catalog instead).
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
      const externalClients = this.listExternalClients(category);
      const candidates = [
        ...rows
          .filter((row) => row.id !== buildingId && clientTypes.includes(row.type))
          .map((row) => ({ id: row.id, type: row.type, x: row.x, y: row.y, label: null })),
        ...externalClients.map((client) => ({ ...client, x: null, y: null })),
      ];

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
        // A good with no eligible TYPE and no external (trade-city) client at all has zero clients
        // here for a structural reason — nobody, ever, not just "none placed nearby yet" — so the
        // view must tell the two apart instead of showing the same "no client" message either way.
        hasEligibleClientTypes: clientTypes.length > 0 || externalClients.length > 0,
        clients: order
          .filter((id) => byId.has(id))
          .map((id) => {
            const candidate = byId.get(id);
            return {
              id,
              type: candidate.type,
              x: candidate.x,
              y: candidate.y,
              label: candidate.label ?? null,
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
