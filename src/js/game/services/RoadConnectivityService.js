/**
 * RoadConnectivityService — legacy.
 *
 * La desserte ville entière tourne désormais via le pipeline ECS :
 * `parcels.roadAccess` dans `createGameRuntime` → `game.update()`.
 *
 * Conservé pour référence / éventuel appel ciblé hors tick.
 * Préférer `parcels.recalculateRoadAccessForNeighbors` ou `syncPlacedBuilding`.
 */

import { SimService } from './SimService.js';
import { getOrCreateParcelsContext } from '../../acl/parcels.js';

/** @deprecated Utiliser createGameRuntime → runSimulation */
export class RoadConnectivityService extends SimService {
  lastUpdateTime = 0;
  updateEveryStep = true;

  async simulate(city, housesStore, time = 0) {
    try {
      const parcels = getOrCreateParcelsContext(housesStore);
      await parcels.recalculateAllRoadAccess.execute();
      this.lastUpdateTime = time;
    } catch (error) {
      console.error('[RoadConnectivityService] Error processing road connectivity:', {
        error: error?.message || error,
        time,
        stack: error?.stack,
      });
    }
  }

  async updateBuilding(housesStore, buildingId) {
    try {
      const parcels = getOrCreateParcelsContext(housesStore);
      await parcels.recalculateRoadAccessForNeighbors.execute([buildingId]);
    } catch (error) {
      console.error('[RoadConnectivityService] Error updating building:', {
        buildingId,
        error: error?.message || error,
      });
    }
  }
}
