import { RunMonthlyLandPurchases } from '../contexts/supply/application/commands/RunMonthlyLandPurchases.js';
import { RunMonthlyForestGrowth } from '../contexts/supply/application/commands/RunMonthlyForestGrowth.js';
import { propRecordSpec } from '../shared/editor-catalog/naturePropCatalog.js';
import { getResourceRoles } from '../contexts/supply/domain/policies/ResourceRolePolicy.js';
import { getBuildingDefinition } from '../shared/building-catalog/index.js';
import {
  getHamletLandPrice,
  getHamletPlots,
  requireActiveHamletId,
  saveHamletPlots,
  setHamletLandPrice,
} from '../core/persistence/hamlet/hamletSession.js';
import { landUseIds } from '../shared/land-catalog/LandUseCatalog.js';
import { getSharedEventBus } from './sharedEventBus.js';

/** Told when a hamlet's plots changed behind the player's back (a company bought some): the map draws them again. */
export const PLOTS_CHANGED_EVENT = 'land.plotsChanged';

/**
 * Composition root — the land the owner's house sells and the producers buy.
 *
 * @param {object} deps
 * @param {ReturnType<import('./createSupplyContext.js').createSupplyContext>} deps.supply
 * @param {ReturnType<import('./createAccountingContext.js').createAccountingContext>} deps.accounting
 * @param {ReturnType<import('./createConstructionContext.js').createConstructionContext>} deps.construction
 */
export function createLandContext({ supply, accounting, construction }) {
  const runMonthlyLandPurchases = new RunMonthlyLandPurchases({
    listBuyers: async () => {
      const producers = await supply.supplyBuildingRepository.findByResourceRole('producer');
      return producers
        .filter((row) => getBuildingDefinition(row.type)?.landPurchase)
        .map((row) => {
          const { landPurchase, displayName } = getBuildingDefinition(row.type);
          const source = getResourceRoles(row.type).find((entry) => entry.role === 'producer' && entry.source?.resource === landPurchase.resource)?.source;
          if (!source) throw new Error(`[land] "${row.type}" buys land for "${landPurchase.resource}" but declares no producer source of it: its range is unknown`);
          return { id: row.id, type: row.type, x: row.x, y: row.y, name: displayName, landPurchase, resource: landPurchase.resource, range: source.range };
        });
    },
    listNaturalResources: () => supply.supplyBuildingRepository.listNaturalResources(),
    listPlots: () => getHamletPlots(requireActiveHamletId()),
    savePlots: (plots) => saveHamletPlots(requireActiveHamletId(), plots),
    priceOf: (use) => getHamletLandPrice(requireActiveHamletId(), use),
    sellLand: (params) => accounting.sellLandToCompany(params),
    onPlotsChanged: () => getSharedEventBus().publish({ type: PLOTS_CHANGED_EVENT }),
  });

  const buildings = supply.supplyBuildingRepository;
  // What a tree of the plantation is as a record: the type its piece stands for (a plant holds nothing, a tree what the owner gathers)
  const recordTypeOf = (prop) => propRecordSpec(prop).type;
  const runMonthlyForestGrowth = new RunMonthlyForestGrowth({
    listPlots: () => getHamletPlots(requireActiveHamletId()),
    savePlots: (plots) => saveHamletPlots(requireActiveHamletId(), plots),
    findRecordAt: async (x, y) => (await buildings.listAllBuildingRows()).find((row) => row.planted && row.x === x && row.y === y) ?? null,
    createRecord: async ({ x, y, prop, stocks, groundY }) => {
      const placed = await construction.placeBuildingRecord({
        name: `${prop}-${x}-${y}`,
        type: recordTypeOf(prop),
        category: 'nature',
        x,
        y,
        pop: 0,
        stocks: { ...stocks },
        maxStocks: { ...stocks },
        roads: 0,
        price: 0,
        isBuilding: false,
        piece: { assetId: prop, rotationY: 0, baseLocalY: groundY },
        planted: true,
      });
      if (!placed?.success) throw new Error(`[forest] the tree planted at (${x}, ${y}) could not be given its record: ${placed?.error ?? 'refused'}`);
    },
    changeRecord: async (recordId, { prop, stocks }) => {
      const row = await buildings.findBuildingRow(recordId);
      await buildings.updateBuildingFields(recordId, {
        type: recordTypeOf(prop),
        stocks: { ...stocks },
        maxStocks: { ...stocks },
        piece: { ...row.piece, assetId: prop },
      });
    },
    resourceOf: async (buyerId) => {
      const row = await buildings.findBuildingRow(buyerId);
      return row ? (getBuildingDefinition(row.type)?.landPurchase?.resource ?? null) : null;
    },
  });

  return {
    runMonthlyLandPurchases: ({ time, label }) => runMonthlyLandPurchases.execute({ time, label }),
    runMonthlyForestGrowth: (timeInfo) => runMonthlyForestGrowth.execute(timeInfo),

    /**
     * What the owner's house sells, at what price per tile, and how many tiles are still for sale or already sold: [{ use, pricePerTile, forSale, sold }] (the "Prix" tab).
     */
    async listLandPrices() {
      const hamletId = requireActiveHamletId();
      const plots = await getHamletPlots(hamletId);
      return Promise.all(landUseIds().map(async (use) => {
        const ofUse = plots.filter((plot) => plot.use === use);
        return {
          use,
          pricePerTile: await getHamletLandPrice(hamletId, use),
          forSale: ofUse.filter((plot) => plot.owner === null).length,
          sold: ofUse.filter((plot) => plot.owner !== null).length,
        };
      }));
    },

    setLandPrice: (use, pricePerTile) => setHamletLandPrice(requireActiveHamletId(), use, pricePerTile),
  };
}
