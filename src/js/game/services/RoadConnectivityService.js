import { SimService } from './SimService.js';
import { createUrbanContext } from '../../../composition/createUrbanContext.js';

/**
 * RoadConnectivityService - Validates and updates road access city-wide
 *
 * Délègue au use case Urban : RecalculateAllRoadAccess.
 */
export class RoadConnectivityService extends SimService {
    lastUpdateTime = 0;
    updateEveryStep = true;

    async simulate(city, housesStore, time = 0) {
        try {
            const urban = createUrbanContext({ housesStore });
            await urban.recalculateAllRoadAccess.execute();
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
            const urban = createUrbanContext({ housesStore });
            await urban.recalculateRoadAccessForBuilding.execute(buildingId);
        } catch (error) {
            console.error('[RoadConnectivityService] Error updating building:', {
                buildingId,
                error: error?.message || error,
            });
        }
    }
}
