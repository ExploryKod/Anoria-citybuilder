import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';
import { listClientTypes, producedCategories, resolveClientPriorities } from '../../../../shared/building-catalog/clientQueries.js';

/**
 * Query: for each producer type whose goods go to a hub and are bought there, the order in which its
 * client types are served (the catalog's default or what the player saved), whether each is served at all,
 * how many of each the player has placed, and what each got last time it asked. Nothing here names a good
 * or a building: producer types and their clients are read from the catalog.
 */
export class ListClientPriorityBoards {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {{ loadSettings: () => Record<string, { order?: string[], disabled?: string[] }> }} options
   */
  constructor(supplyBuildingRepository, { loadSettings }) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.loadSettings = loadSettings;
  }

  /**
   * @returns {Promise<Array<{
   *   producerType: string,
   *   categories: string[],
   *   placed: number,
   *   isCustom: boolean,
   *   clients: Array<{ type: string, placed: number, disabled: boolean, wanted: number, served: number }>,
   * }>>}
   */
  async execute() {
    const rows = await this.supplyBuildingRepository.listAllBuildingRows();
    const placed = {};
    for (const row of rows) placed[row.type] = (placed[row.type] ?? 0) + 1;

    // What each client type asked for and got at the hubs, last time it asked, per good.
    const asked = {};
    for (const row of rows) {
      for (const [category, byClient] of Object.entries(row.clientDemand ?? {})) {
        for (const [client, entry] of Object.entries(byClient)) {
          const key = `${category}|${client}`;
          asked[key] = {
            wanted: (asked[key]?.wanted ?? 0) + entry.wanted,
            served: (asked[key]?.served ?? 0) + entry.served,
          };
        }
      }
    }

    const settings = this.loadSettings() ?? {};
    const boards = [];
    for (const producerType of Object.keys(buildingCatalog)) {
      const categories = producedCategories(producerType);
      if (categories.length === 0 || listClientTypes(categories).length === 0) continue;

      const { order, disabled } = resolveClientPriorities(producerType, settings[producerType]);
      boards.push({
        producerType,
        categories,
        placed: placed[producerType] ?? 0,
        isCustom: Boolean(settings[producerType]),
        clients: order.map((type) => ({
          type,
          placed: placed[type] ?? 0,
          disabled: disabled.includes(type),
          wanted: categories.reduce((sum, category) => sum + (asked[`${category}|${type}`]?.wanted ?? 0), 0),
          served: categories.reduce((sum, category) => sum + (asked[`${category}|${type}`]?.served ?? 0), 0),
        })),
      });
    }
    return boards;
  }
}
