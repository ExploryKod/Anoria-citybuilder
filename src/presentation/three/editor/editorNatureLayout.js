/**
 * In-memory editor stack — tile base terrain on `city.tiles`; lego pieces here.
 */

/**
 * @typedef {'terrain' | 'stack' | 'sea'} EditorStackAnchor
 */

/** @typedef {import('../../shared/editor-catalog/editorKenneyAssetBehavior.js').EditorAssetMountMode} EditorAssetMountMode */

/** @typedef {import('../../shared/editor-catalog/editorKenneyAssetBehavior.js').EditorVerticalFaceDirection | null} EditorVerticalFaceDirection */

/**
 * @typedef {object} EditorStackObject
 * @property {string} id
 * @property {string} assetId — `nature:*` or `nature-prop:*`
 * @property {number} x
 * @property {number} y
 * @property {number} rotationY
 * @property {number} baseLocalY — feet surface height relative to WORLD_PLATFORM_Y
 * @property {string | null} parentId — stacked object id, or null when anchored to tile base
 * @property {EditorStackAnchor} anchor — tile terrain / sea / another stack piece
 * @property {EditorAssetMountMode} mountMode — `surface` (default) or `verticalFace` (river on cliff)
 * @property {EditorVerticalFaceDirection} faceDirection — set when mountMode is verticalFace
 * @property {string | null} hostAssetId — cliff asset id when grafted on a vertical face
 */

/** @type {EditorStackObject[]} */
let stackObjects = [];
let nextId = 1;

export function resetEditorNatureLayout() {
  stackObjects = [];
  nextId = 1;
}

/**
 * Replace in-memory stack from an imported layout (mission load / editor import).
 *
 * @param {readonly import('../../../contexts/world-layout/domain/EditorMapLayout.js').EditorStackObjectSnapshot[]} objects
 */
export function importEditorStackObjects(objects) {
  stackObjects = objects.map((obj) => ({
    mountMode: 'surface',
    faceDirection: null,
    hostAssetId: null,
    ...obj,
  }));
  const maxId = stackObjects.reduce((max, obj) => {
    const match = /^stack-(\d+)$/.exec(obj.id);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  nextId = maxId + 1;
}

/** @returns {readonly EditorStackObject[]} */
export function getEditorNatureObjects() {
  return stackObjects;
}

/** @returns {readonly EditorStackObject[]} */
export function getEditorStackObjects() {
  return stackObjects;
}

/**
 * @param {string} id
 * @returns {EditorStackObject | undefined}
 */
export function getEditorStackObjectById(id) {
  return stackObjects.find((obj) => obj.id === id);
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {EditorStackObject[]}
 */
export function getEditorStackObjectsAt(x, y) {
  return stackObjects.filter((obj) => obj.x === x && obj.y === y);
}

/**
 * @param {string} assetId
 * @param {number} x
 * @param {number} y
 * @param {number} rotationY
 * @param {{ baseLocalY: number, parentId: string | null, anchor: EditorStackAnchor }} placement
 * @returns {EditorStackObject}
 */
export function addEditorStackObject(assetId, x, y, rotationY, placement) {
  const entry = {
    id: `stack-${nextId}`,
    assetId,
    x,
    y,
    rotationY,
    baseLocalY: placement.baseLocalY,
    parentId: placement.parentId,
    anchor: placement.anchor,
    mountMode: placement.mountMode ?? 'surface',
    faceDirection: placement.faceDirection ?? null,
    hostAssetId: placement.hostAssetId ?? null,
  };
  nextId += 1;
  stackObjects.push(entry);
  return entry;
}

/** @deprecated use addEditorStackObject */
export function addEditorNatureObject(assetId, x, y, rotationY = 0, placement) {
  return addEditorStackObject(assetId, x, y, rotationY, placement);
}

/**
 * @param {string} id
 * @returns {EditorStackObject[]}
 */
export function collectEditorStackDescendants(id) {
  const result = [];
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const obj of stackObjects) {
      if (obj.parentId === current) {
        result.push(obj);
        queue.push(obj.id);
      }
    }
  }
  return result;
}

/**
 * @param {string} id
 * @returns {EditorStackObject | null}
 */
export function removeEditorStackObjectById(id) {
  const toRemove = new Set([id]);
  for (const descendant of collectEditorStackDescendants(id)) {
    toRemove.add(descendant.id);
  }

  const removed = stackObjects.find((obj) => obj.id === id) ?? null;
  stackObjects = stackObjects.filter((obj) => !toRemove.has(obj.id));
  return removed;
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {EditorStackObject[]}
 */
export function removeEditorStackObjectsAtTile(x, y) {
  const atTile = stackObjects.filter((obj) => obj.x === x && obj.y === y);
  const ids = new Set(atTile.map((obj) => obj.id));
  for (const obj of atTile) {
    for (const descendant of collectEditorStackDescendants(obj.id)) {
      ids.add(descendant.id);
    }
  }
  const removed = stackObjects.filter((obj) => ids.has(obj.id));
  stackObjects = stackObjects.filter((obj) => !ids.has(obj.id));
  return removed;
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {EditorStackObject | null}
 */
export function removeTopEditorStackObjectAt(x, y) {
  const atTile = getEditorStackObjectsAt(x, y);
  if (atTile.length === 0) return null;
  const top = atTile.reduce((best, obj) => (
    obj.baseLocalY > best.baseLocalY ? obj : best
  ));
  return removeEditorStackObjectById(top.id);
}

/** @deprecated */
export function removeEditorNatureObjectById(id) {
  return removeEditorStackObjectById(id);
}

/** @deprecated */
export function removeTopEditorNatureObjectAt(x, y) {
  return removeTopEditorStackObjectAt(x, y);
}

/** @deprecated */
export function removeEditorNatureObjectAt(x, y) {
  return removeTopEditorStackObjectAt(x, y);
}

/**
 * @param {object} city
 * @param {number} city.size
 * @param {object[][]} city.tiles
 * @param {{ id?: string, name?: string }} [meta]
 * @returns {object}
 */
export function serializeEditorLayout(city, meta = {}) {
  const terrain = [];
  for (let x = 0; x < city.size; x += 1) {
    const row = [];
    for (let y = 0; y < city.size; y += 1) {
      row.push(city.tiles[x]?.[y]?.terrainId ?? 'grass');
    }
    terrain.push(row);
  }

  return {
    uuid: meta.id,
    name: meta.name,
    version: 3,
    citySize: city.size,
    terrain,
    stackObjects: stackObjects.map((obj) => ({ ...obj })),
    /** @deprecated */ natureObjects: stackObjects.map((obj) => ({ ...obj })),
  };
}
