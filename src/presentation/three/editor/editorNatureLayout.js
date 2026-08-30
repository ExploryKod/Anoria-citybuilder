/**
 * In-memory editor layout — terrain matrix lives on `city.tiles`; nature props here.
 */

/**
 * @typedef {object} EditorNatureObject
 * @property {string} id
 * @property {string} assetId — `nature-prop:*`
 * @property {number} x
 * @property {number} y
 * @property {number} rotationY
 */

/** @type {EditorNatureObject[]} */
let natureObjects = [];
let nextId = 1;

export function resetEditorNatureLayout() {
  natureObjects = [];
  nextId = 1;
}

/** @returns {readonly EditorNatureObject[]} */
export function getEditorNatureObjects() {
  return natureObjects;
}

/**
 * @param {string} assetId
 * @param {number} x
 * @param {number} y
 * @param {number} [rotationY=0]
 * @returns {EditorNatureObject}
 */
export function addEditorNatureObject(assetId, x, y, rotationY = 0) {
  const entry = {
    id: `nature-${nextId}`,
    assetId,
    x,
    y,
    rotationY,
  };
  nextId += 1;
  natureObjects.push(entry);
  return entry;
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {EditorNatureObject | null}
 */
export function removeEditorNatureObjectAt(x, y) {
  const index = natureObjects.findIndex((obj) => obj.x === x && obj.y === y);
  if (index < 0) return null;
  const [removed] = natureObjects.splice(index, 1);
  return removed;
}

/**
 * @param {object} city
 * @param {number} city.size
 * @param {object[][]} city.tiles
 * @returns {object}
 */
export function serializeEditorLayout(city) {
  const terrain = [];
  for (let x = 0; x < city.size; x += 1) {
    const row = [];
    for (let y = 0; y < city.size; y += 1) {
      row.push(city.tiles[x]?.[y]?.terrainId ?? 'grass');
    }
    terrain.push(row);
  }

  return {
    version: 1,
    citySize: city.size,
    terrain,
    natureObjects: natureObjects.map((obj) => ({ ...obj })),
  };
}
