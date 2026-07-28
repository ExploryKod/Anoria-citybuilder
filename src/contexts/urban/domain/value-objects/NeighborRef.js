/**
 * Référence à un voisin sur la grille (données métier, pas de mesh Three.js).
 */
export function createNeighborRef({ buildingId = '', isRoad = false } = {}) {
  return Object.freeze({ buildingId, isRoad });
}

/**
 * Traduit un voisin legacy (IndexedDB / mesh userData) vers le modèle Urban.
 * Vit ici car c'est la frontière sémantique du BC Urban.
 */
export function fromLegacyNeighbor(raw) {
  if (!raw || typeof raw !== 'object') {
    return createNeighborRef();
  }

  const isRoad = Boolean(
    raw.isRoad ||
    raw.userData?.isRoad ||
    raw.name === 'roads' ||
    raw.name === 'Road' ||
    raw.buildingId === 'roads'
  );

  const buildingId = raw.buildingId || raw.name || raw.type || '';

  return createNeighborRef({ buildingId, isRoad });
}
