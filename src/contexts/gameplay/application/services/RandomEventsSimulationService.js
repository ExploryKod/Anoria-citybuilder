import { selectDisasterEvent } from '../../domain/catalogs/DisasterEventCatalog.js';
import {
  getFirstYearEnd,
  getMinTurnsBetweenEvents,
  isHouseBuildingType,
  shouldTriggerDisasterEvent,
} from '../../domain/policies/RandomEventPolicy.js';
import { BrowserDisasterNotificationAdapter } from '../../infrastructure/browser/BrowserDisasterNotificationAdapter.js';

export class RandomEventsSimulationService {
  /**
   * @param {object} deps
   * @param {() => boolean} deps.isEventsEnabled
   * @param {() => number} deps.getEventProbabilityPercent
   * @param {() => number} deps.getDaysPerMonth
   * @param {() => Promise<Array>} deps.listAllBuildingRows
   * @param {(params: { instanceId: string }) => Promise<unknown>} deps.syncRemovedBuilding
   * @param {(row: object) => string|null} deps.instanceIdFromHouseRow
   * @param {(amount: number, description: string) => Promise<unknown>} deps.recordExceptionalRepairExpense
   * @param {() => object|null} deps.getGameScene
   * @param {() => object|null} deps.getGameCity
   * @param {() => number} deps.getGameTime
   * @param {() => number} [deps.random]
   * @param {BrowserDisasterNotificationAdapter} [deps.notificationAdapter]
   */
  constructor(deps) {
    this.isEventsEnabled = deps.isEventsEnabled;
    this.getEventProbabilityPercent = deps.getEventProbabilityPercent;
    this.getDaysPerMonth = deps.getDaysPerMonth;
    this.listAllBuildingRows = deps.listAllBuildingRows;
    this.syncRemovedBuilding = deps.syncRemovedBuilding;
    this.instanceIdFromHouseRow = deps.instanceIdFromHouseRow;
    this.recordExceptionalRepairExpense = deps.recordExceptionalRepairExpense;
    this.getGameScene = deps.getGameScene;
    this.getGameCity = deps.getGameCity;
    this.getGameTime = deps.getGameTime;
    this.random = deps.random ?? Math.random;
    this.notificationAdapter =
      deps.notificationAdapter ?? new BrowserDisasterNotificationAdapter();

    this.lastEventTurn = -10;
    this.eventProbability = 0.05;
    this.minTurnsBetweenEvents = 10;
    this.firstYearEnd = getFirstYearEnd(this.getDaysPerMonth());
  }

  refreshTimingSettings() {
    const probabilityPercent = this.getEventProbabilityPercent();
    this.eventProbability = probabilityPercent / 100;
    this.minTurnsBetweenEvents = getMinTurnsBetweenEvents(probabilityPercent);
    this.firstYearEnd = getFirstYearEnd(this.getDaysPerMonth());
  }

  async findRandomHouse() {
    try {
      const allHouses = await this.listAllBuildingRows();
      const houses = allHouses.filter((house) => isHouseBuildingType(house.type));
      if (houses.length === 0) {
        return null;
      }
      const randomIndex = Math.floor(this.random() * houses.length);
      return houses[randomIndex];
    } catch (error) {
      console.error('[RandomEventsSimulationService] Error finding random house:', error);
      return null;
    }
  }

  async removeBuildingFromScene(house, city) {
    try {
      const { x, y } = house;
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !city.tiles ||
        !city.tiles[x] ||
        !city.tiles[x][y]
      ) {
        console.warn('[RandomEventsSimulationService] Invalid coordinates:', { x, y });
        return false;
      }

      city.tiles[x][y].buildingId = undefined;
      return true;
    } catch (error) {
      console.error('[RandomEventsSimulationService] Error removing building from scene:', error);
      return false;
    }
  }

  async triggerEvent(event, city) {
    try {
      const houseToDestroy = await this.findRandomHouse();
      if (!houseToDestroy) {
        return false;
      }

      await this.recordExceptionalRepairExpense(
        event.cost,
        `${event.name}: ${event.description} - Maison détruite et réparations`
      );

      const houseId = this.instanceIdFromHouseRow(houseToDestroy);
      if (houseId) {
        await this.syncRemovedBuilding({ instanceId: houseId });
      }

      await this.removeBuildingFromScene(houseToDestroy, city);

      const scene = this.getGameScene();
      const gameCity = this.getGameCity();
      if (scene && gameCity) {
        try {
          const currentTime = this.getGameTime();
          await scene.update(gameCity, currentTime, { skipBudget: true });
        } catch (err) {
          console.warn('[RandomEventsSimulationService] Could not force scene update:', err);
        }
      }

      this.notificationAdapter.show(event, houseToDestroy);
      return true;
    } catch (error) {
      console.error('[RandomEventsSimulationService] Error triggering event:', error);
      return false;
    }
  }

  /**
   * @param {object} city
   * @param {number} [time=0]
   */
  async simulate(city, time = 0) {
    try {
      this.refreshTimingSettings();

      const allHouses = await this.listAllBuildingRows();
      const houseCount = allHouses.filter((house) =>
        isHouseBuildingType(house.type)
      ).length;

      const shouldTrigger = shouldTriggerDisasterEvent({
        enabled: this.isEventsEnabled(),
        time,
        firstYearEnd: this.firstYearEnd,
        turnsSinceLastEvent: time - this.lastEventTurn,
        minTurnsBetweenEvents: this.minTurnsBetweenEvents,
        houseCount,
        randomValue: this.random(),
        probability: this.eventProbability,
      });

      if (!shouldTrigger) {
        return;
      }

      const event = selectDisasterEvent(this.random());
      const triggered = await this.triggerEvent(event, city);
      if (triggered) {
        this.lastEventTurn = time;
      }
    } catch (error) {
      console.error('[RandomEventsSimulationService] Error in simulate:', error);
    }
  }
}
