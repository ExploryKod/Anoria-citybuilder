/**
 * Identifiant métier d'un bâtiment : "{type}-{x}-{y}"
 */
export function createBuildingId(type, x, y) {
  if (!type || typeof type !== 'string') {
    throw new Error(`BuildingId: invalid type "${type}"`);
  }
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`BuildingId: invalid coordinates (${x}, ${y})`);
  }
  return Object.freeze({ type, x, y, value: `${type}-${x}-${y}` });
}

export function parseBuildingId(value) {
  if (!value || typeof value !== 'string') {
    throw new Error(`BuildingId: invalid value "${value}"`);
  }
  const parts = value.split('-');
  if (parts.length < 3) {
    throw new Error(`BuildingId: cannot parse "${value}"`);
  }
  const y = Number(parts.pop());
  const x = Number(parts.pop());
  const type = parts.join('-');
  return createBuildingId(type, x, y);
}
