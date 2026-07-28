import { SimService } from './SimService.js';
import { hasRoadAccessFromCount } from '../../acl/parcels.js';
import { createSupplyContext, toSupplyMonth } from '../../acl/supply.js';
import { TimeManager } from '../utils/TimeManager.js';

/**
 * WindmillService - Manages windmill food collection from farms
 *
 * Stock transfers + UI flags go through Supply BC; salesToWindmill tracking stays here.
 */
export class WindmillService extends SimService {
    /**
     * @param {City} city
     * @param {HousesStore} housesStore
     * @param {number} time
     */
    async simulate(city, housesStore, time = 0) {
        const timeInfo = TimeManager.getTimeInfo(time);
        const month = toSupplyMonth(timeInfo.month);
        const supply = createSupplyContext({ housesStore });
        const isDecember = timeInfo.monthIndex === 11;

        if (!isDecember) {
            await supply.markCollectingSeason(month);
            await supply.resetSoldToWindmill({ onlyIfSet: true });
            return;
        }

        try {
            const houses = await housesStore.listAllHouses();

            const windmills = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });

            if (timeInfo.dayInMonth === 1) {
                await this.resetFarmSalesTracking(housesStore, timeInfo.year);
                await supply.resetSoldToWindmill({ onlyIfSet: false });
            }

            await supply.markCollectingSeason(month);

            const farms = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Farm') || type.includes('farm');
            });

            for (const windmill of windmills) {
                await this.processWindmill(windmill, farms, housesStore, time);
            }
        } catch (error) {
            console.error('[WindmillService] Error processing windmill collection:', {
                error: error?.message || error,
                time,
                stack: error?.stack
            });
        }
    }

    /**
     * @param {Object} windmill
     * @param {Array} allFarms
     * @param {HousesStore} housesStore
     * @param {number} time
     */
    async processWindmill(windmill, allFarms, housesStore, time = 0) {
        const windmillId = windmill.id || windmill.name;
        const supply = createSupplyContext({ housesStore });

        const windmillData = await housesStore.getHouse(windmillId);
        if (!windmillData) {
            console.warn('[WindmillService] Windmill not found in database:', windmillId);
            return;
        }

        if (!hasRoadAccessFromCount(windmillData.roads)) {
            await supply.setWindmillCollecting(windmillId, false);
            return;
        }

        const windmillEmployees = windmillData.employees || { worker: 0, worker_need: 0 };
        const windmillWorkers = windmillEmployees.worker || 0;
        const windmillWorkerNeed = windmillEmployees.worker_need || 0;
        const hasNoWorkers = windmillWorkers === 0 && windmillWorkerNeed > 0;

        if (hasNoWorkers) {
            await supply.setWindmillCollecting(windmillId, false);
            return;
        }

        await supply.setWindmillCollecting(windmillId, true);
        await this.collectFoodFromFarms(windmillId, allFarms, housesStore, time);
    }

    /**
     * @param {string} windmillId
     * @param {Array} farms
     * @param {HousesStore} housesStore
     * @param {number} time
     */
    async collectFoodFromFarms(windmillId, farms, housesStore, time = 0) {
        const timeInfo = TimeManager.getTimeInfo(time);
        const month = toSupplyMonth(timeInfo.month);
        const supply = createSupplyContext({ housesStore });

        const outcome = await supply.collectFromAllFarms(
            windmillId,
            farms ?? [],
            month
        );

        if (!outcome.collected) {
            if (outcome.reason === 'windmill_not_operational') {
                await supply.setWindmillCollecting(windmillId, false);
            }

            await housesStore.updateHouseFields(windmillId, {
                lastCollection: { wheat: 0, carrot: 0, cabbage: 0, total: 0 },
            }).catch(err => {
                console.warn('[WindmillService] Failed to update windmill lastCollection:', {
                    windmillId,
                    error: err?.message || err
                });
            });

            if (outcome.reason && outcome.reason !== 'nothing_to_collect') {
                console.info('[WindmillService] Collection skipped:', {
                    windmillId,
                    reason: outcome.reason,
                    month: timeInfo.month,
                });
            }
            return;
        }

        const lastCollection = {
            wheat: 0,
            carrot: 0,
            cabbage: 0,
            total: outcome.totalBaskets,
        };

        for (const transfer of outcome.transfers) {
            if (transfer.crop === 'wheat' || transfer.crop === 'cabbage') {
                await supply.markFarmSoldToWindmill(transfer.farmId, true);
            }

            if (lastCollection[transfer.crop] != null) {
                lastCollection[transfer.crop] += transfer.amount;
            }

            const farmData = await housesStore.getHouse(transfer.farmId);
            if (farmData) {
                await this.trackFarmSaleToWindmill(
                    transfer.farmId,
                    farmData,
                    housesStore,
                    timeInfo,
                    transfer.crop,
                    transfer.amount,
                    windmillId
                );
            }
        }

        await housesStore.updateHouseFields(windmillId, { lastCollection }).catch(err => {
            console.warn('[WindmillService] Failed to update windmill lastCollection:', {
                windmillId,
                error: err?.message || err
            });
        });

        console.info('[WindmillService] Collection via Supply BC:', {
            windmillId,
            totalBaskets: outcome.totalBaskets,
            transfers: outcome.transfers.length,
        });
    }

    async trackFarmSaleToWindmill(farmId, farmData, housesStore, timeInfo, productType, quantity, windmillId) {
        try {
            const salesToMarket = farmData.salesToMarket || [];
            const salesToWindmill = farmData.salesToWindmill || [];
            const currentYear = timeInfo.year || 0;

            const existingSaleIndex = salesToWindmill.findIndex(sale =>
                sale.year === currentYear && sale.productType === productType
            );

            if (existingSaleIndex >= 0) {
                salesToWindmill[existingSaleIndex].quantity += quantity;
                salesToWindmill[existingSaleIndex].count += 1;
            } else {
                salesToWindmill.push({
                    year: currentYear,
                    productType: productType,
                    quantity: quantity,
                    count: 1,
                    windmillId: windmillId,
                    date: new Date().toISOString()
                });
            }

            const filteredSales = salesToWindmill.filter(sale => sale.year === currentYear);

            await housesStore.updateHouseFields(farmId, {
                salesToMarket: salesToMarket,
                salesToWindmill: filteredSales
            });
        } catch (error) {
            console.warn('[WindmillService] Error tracking farm sale to windmill:', {
                farmId,
                error: error?.message || error
            });
        }
    }

    async resetFarmSalesTracking(housesStore, currentYear) {
        try {
            const allHouses = await housesStore.listAllHouses();
            const farms = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Farm') || type.includes('farm');
            });

            for (const farm of farms) {
                const farmId = farm.id || farm.name;
                const farmData = await housesStore.getHouse(farmId);
                if (farmData) {
                    const salesToMarket = (farmData.salesToMarket || []).filter(sale => sale.year === currentYear);
                    const salesToWindmill = (farmData.salesToWindmill || []).filter(sale => sale.year === currentYear);

                    await housesStore.updateHouseFields(farmId, {
                        salesToMarket: salesToMarket,
                        salesToWindmill: salesToWindmill
                    });
                }
            }
        } catch (error) {
            console.warn('[WindmillService] Error resetting farm sales tracking:', {
                error: error?.message || error
            });
        }
    }
}
