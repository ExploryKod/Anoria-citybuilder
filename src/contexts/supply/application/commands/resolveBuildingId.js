/**
 * Published building id from neighbor / legacy blob / HousesStore row.
 *
 * HousesStore rows use `name` as the full id (`House-Purple-3-7`).
 * Neighbor blobs use `id` for the full id and `name`/`type` for the building type.
 */
export function resolveBuildingId(ref) {
  if (!ref || typeof ref !== 'object') return null;

  if (typeof ref.id === 'string' && ref.id.length > 0) {
    return ref.id;
  }

  if (typeof ref.buildingId === 'string' && ref.buildingId.length > 0) {
    return ref.buildingId;
  }

  // Dexie primary key is often already "{type}-{x}-{y}"
  if (typeof ref.name === 'string' && isPublishedBuildingId(ref.name)) {
    return ref.name;
  }

  const type =
    (typeof ref.type === 'string' && ref.type.length > 0 && ref.type) ||
    (typeof ref.name === 'string' && ref.name.length > 0 && ref.name) ||
    null;

  if (type && ref.x != null && ref.y != null) {
    const x = Number(ref.x);
    const y = Number(ref.y);
    if (Number.isInteger(x) && Number.isInteger(y)) {
      return `${type}-${x}-${y}`;
    }
  }

  // Last resort: bare name (legacy)
  if (typeof ref.name === 'string' && ref.name.length > 0) {
    return ref.name;
  }

  return null;
}

/** @param {string} value */
function isPublishedBuildingId(value) {
  return /^.+-\d+-\d+$/.test(value);
}
