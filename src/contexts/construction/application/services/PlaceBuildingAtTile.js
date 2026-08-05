import { createBuildingInstanceId } from '../../../../shared/building-identity/index.js';
import {
  canPlaceBuildingAtTile,
  isRoadBuildingType,
  stampBuildingFootprint,
} from '../../domain/policies/FootprintAvailabilityPolicy.js';

/**
 * Player placement: footprint checks → reclaim ghosts → pay → stamp city tiles.
 * Presentation (scene.update, employment, multiplayer, toasts) stays at the call site.
 */
export class PlaceBuildingAtTile {
  /**
   * @param {object} deps
   * @param {(data: object) => Promise<object>} deps.placeBuildingWithPayment
   * @param {(params: { city: object, x: number, y: number, gridSize?: number }) => Promise<string[]>} deps.reclaimStaleBuildingRecords
   * @param {(buildingType: string) => object} deps.getDefaultEmployees
   * @param {() => Promise<unknown>} deps.awaitBudgetReady
   * @param {() => Promise<{ funds?: number }>} deps.getTreasurySnapshot
   * @param {Record<string, { price?: number, gridSize?: number }>} deps.assetCatalog
   * @param {(buildingId: string, catalog: object) => number | null | undefined} deps.getAssetPrice
   * @param {(params: { city: object, x: number, y: number, buildingType: string, assetCatalog: object }) => { ok: boolean, reason?: string }} [deps.validatePlacement]
   */
  constructor({
    placeBuildingWithPayment,
    reclaimStaleBuildingRecords,
    getDefaultEmployees,
    awaitBudgetReady,
    getTreasurySnapshot,
    assetCatalog,
    getAssetPrice,
    validatePlacement = null,
  }) {
    this.placeBuildingWithPayment = placeBuildingWithPayment;
    this.reclaimStaleBuildingRecords = reclaimStaleBuildingRecords;
    this.getDefaultEmployees = getDefaultEmployees;
    this.awaitBudgetReady = awaitBudgetReady;
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.assetCatalog = assetCatalog;
    this.getAssetPrice = getAssetPrice;
    this.validatePlacement = validatePlacement;
    this.pendingPlacements = new Set();
  }

  /**
   * @param {object} params
   * @param {{ size: number, tiles: object[][] }} params.city
   * @param {number} params.x
   * @param {number} params.y
   * @param {string} params.buildingType
   * @param {number} params.gameTurn
   * @returns {Promise<{
   *   success: boolean,
   *   reason?: string,
   *   buildingType: string,
   *   price?: number,
   *   instanceId?: string,
   *   gridSize?: number,
   * }>}
   */
  async execute({ city, x, y, buildingType, gameTurn }) {
    const placement = canPlaceBuildingAtTile({
      city,
      x,
      y,
      buildingType,
      assetCatalog: this.assetCatalog,
    });
    if (!placement.ok) {
      return {
        success: false,
        reason: placement.reason || 'area_not_available',
        buildingType,
      };
    }

    if (this.validatePlacement) {
      const extra = this.validatePlacement({
        city,
        x,
        y,
        buildingType,
        assetCatalog: this.assetCatalog,
      });
      if (!extra.ok) {
        return {
          success: false,
          reason: extra.reason || 'placement_not_allowed',
          buildingType,
        };
      }
    }

    const { gridSize } = placement;
    const tile = city.tiles?.[x]?.[y];
    const isRoadTool = isRoadBuildingType(buildingType);
    const canPlaceRoad =
      isRoadTool && (!tile?.buildingId || isRoadBuildingType(tile?.buildingId));

    const placementKey = `${x}-${y}`;
    if (this.pendingPlacements.has(placementKey)) {
      console.warn('[Construction] Building placement already in progress:', placementKey);
      return { success: false, reason: 'in_progress', buildingType };
    }

    this.pendingPlacements.add(placementKey);
    const stuckTimer = setTimeout(() => {
      if (this.pendingPlacements.has(placementKey)) {
        console.warn('[Construction] Clearing stuck pending placement for:', placementKey);
        this.pendingPlacements.delete(placementKey);
      }
    }, 10000);

    try {
      await this.awaitBudgetReady();

      if (tile?.buildingId && !canPlaceRoad) {
        return { success: false, reason: 'building_already_exists', buildingType };
      }

      const reclaimedIds = await this.reclaimStaleBuildingRecords({
        city,
        x,
        y,
        gridSize,
      });
      if (reclaimedIds.length > 0) {
        console.info('[Construction] Reclaimed stale Dexie rows before placement:', reclaimedIds);
      }

      const price = this.getAssetPrice(buildingType, this.assetCatalog) || 0;
      const instanceId = createBuildingInstanceId();
      const budgetData = await this.getTreasurySnapshot().catch(() => ({ funds: 0 }));
      const funds = budgetData.funds || 0;

      const dbHouseData = {
        instanceId,
        type: buildingType,
        category: 'construction',
        neighbors: [],
        pop: 0,
        stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
        gameTurn,
        time: 0,
        isBuilding: true,
        roads: 0,
        stage: 0,
        stageName: '',
        price,
        cityFunds: funds,
        maintenance: 0,
        worldTime: 0,
        x,
        y,
        gridSize,
        footprintWidth: gridSize,
        footprintHeight: gridSize,
        employees: this.getDefaultEmployees(buildingType),
      };

      const paymentResult = await this.placeBuildingWithPayment(dbHouseData);

      if (!paymentResult.success && paymentResult.reason === 'duplicate') {
        return { success: false, reason: 'building_already_exists', buildingType, price };
      }

      if (!paymentResult.success) {
        return {
          success: false,
          reason: paymentResult.reason || 'database_error',
          buildingType,
          price,
        };
      }

      const placedInstanceId = paymentResult.instanceId ?? instanceId;
      stampBuildingFootprint(city, x, y, gridSize, buildingType, placedInstanceId);

      return {
        success: true,
        buildingType,
        price,
        instanceId: placedInstanceId,
        gridSize,
      };
    } catch (placementError) {
      console.error('[Construction] Building placement failed:', placementError);
      return { success: false, reason: 'persistence_conflict', buildingType };
    } finally {
      clearTimeout(stuckTimer);
      this.pendingPlacements.delete(placementKey);
    }
  }
}
