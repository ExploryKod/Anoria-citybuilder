/**
 * Port : découverte spatiale des voisins sur la grille.
 * Indépendant de Three.js — adapter scène, grille pure JS, tests, etc.
 */
export class SpatialNeighborhoodPort {
  /**
   * @param {{ x: number, y: number, type?: string, zones?: number[] }} _query
   * @returns {Promise<object[]>} voisins bruts (forme legacy / scan)
   */
  async discoverInZones(_query) {
    throw new Error('SpatialNeighborhoodPort: port not implemented');
  }
}
