/**
 * Query: aggregate natural resources available to factories across the city.
 */
export class GetCityFactoryResources {
  /**
   * @param {import('../ports/FactoryBuildingRepository.js').FactoryBuildingRepository} factoryBuildingRepository
   */
  constructor(factoryBuildingRepository) {
    this.repository = factoryBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {object} params.city
   * @returns {Promise<{ wood: number, rock: number, clay: number, iron: number, gold: number }>}
   */
  async execute({ city }) {
    const resources = {
      wood: 0,
      rock: 0,
      clay: 0,
      iron: 0,
      gold: 0,
    };

    try {
      const houses = await this.repository.listAllRows();

      for (const house of houses) {
        if ((house.category || '') !== 'nature') continue;

        const type = house.type || '';
        const stocks = house.stocks || {};

        if (type.includes('Tree')) {
          resources.wood += stocks.wood || 0;
        } else if (type.includes('Boulder')) {
          resources.rock += stocks.rock || 0;
          resources.iron += stocks.iron || 0;
          resources.gold += stocks.gold || 0;
        }
      }

      for (let x = 0; x < city.size; x++) {
        for (let y = 0; y < city.size; y++) {
          const tile = city.tiles[x]?.[y];
          if (tile?.hasClay) {
            resources.clay += 1;
          }
        }
      }
    } catch (_error) {
      // Preserve legacy silent failure
    }

    return resources;
  }
}
