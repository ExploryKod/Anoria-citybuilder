import { getBuildingsNamesInZone } from './sceneNeighborhoodScan.js';

/**
 * Adapter : scan voisinage via la grille Three.js / scene (getBuildingsNamesInZone).
 * Le contexte de scan est fourni à chaque frame par scene.update (bind).
 */
export class SceneSpatialNeighborhoodAdapter {
  constructor() {
    /** @type {{ city: object, buildings: object, terrain?: object, time?: number } | null} */
    this._ctx = null;
  }

  /**
   * @param {{ city: object, buildings: object, terrain?: object, time?: number }} ctx
   */
  bind(ctx) {
    this._ctx = ctx ?? null;
  }

  /**
   * @param {{ x: number, y: number, type?: string, zones?: number[] }} query
   * @returns {Promise<object[]>}
   */
  async discoverInZones({ x, y, type = '', zones = [1, 2] }) {
    if (!this._ctx?.buildings || x == null || y == null) {
      return [];
    }

    const { city, buildings, terrain, time = 0 } = this._ctx;
    const buildingData = {
      city,
      buildings,
      terrain,
      x,
      y,
      currentBuildingId: type,
    };

    const found = getBuildingsNamesInZone(buildingData, time, {
      buildingTarget: '',
      zones,
    });

    return Array.isArray(found) ? found : [];
  }
}
