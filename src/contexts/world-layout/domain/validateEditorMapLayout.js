/** @typedef {import('./EditorMapLayout.js').EditorMapLayout} EditorMapLayout */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} raw
 * @returns {EditorMapLayout}
 */
export function parseEditorMapLayout(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Editor map layout must be a JSON object');
  }

  const doc = /** @type {Record<string, unknown>} */ (raw);
  const version = doc.version;
  if (version !== 3) {
    throw new Error(`Unsupported editor map layout version: ${String(version)}`);
  }

  const id = isNonEmptyString(doc.uuid) ? doc.uuid.trim() : '';
  if (!UUID_RE.test(id)) {
    throw new Error('Editor map layout requires a valid uuid field');
  }

  const name = isNonEmptyString(doc.name) ? doc.name.trim() : id;
  const citySize = doc.citySize;
  if (typeof citySize !== 'number' || citySize < 1 || citySize > 32) {
    throw new Error('Editor map layout citySize must be between 1 and 32');
  }

  const terrain = doc.terrain;
  if (!Array.isArray(terrain) || terrain.length !== citySize) {
    throw new Error('Editor map layout terrain grid size mismatch');
  }

  for (let x = 0; x < citySize; x += 1) {
    const row = terrain[x];
    if (!Array.isArray(row) || row.length !== citySize) {
      throw new Error(`Editor map layout terrain row ${x} size mismatch`);
    }
    for (let y = 0; y < citySize; y += 1) {
      if (typeof row[y] !== 'string') {
        throw new Error(`Editor map layout terrain[${x}][${y}] must be a string`);
      }
    }
  }

  const stackSource = Array.isArray(doc.stackObjects)
    ? doc.stackObjects
    : Array.isArray(doc.natureObjects)
      ? doc.natureObjects
      : null;
  if (!stackSource) {
    throw new Error('Editor map layout requires stackObjects array');
  }

  /** @type {import('./EditorMapLayout.js').EditorStackObjectSnapshot[]} */
  const stackObjects = stackSource.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`stackObjects[${index}] must be an object`);
    }
    const obj = /** @type {Record<string, unknown>} */ (entry);
    if (!isNonEmptyString(obj.id) || !isNonEmptyString(obj.assetId)) {
      throw new Error(`stackObjects[${index}] requires id and assetId`);
    }
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') {
      throw new Error(`stackObjects[${index}] requires numeric x and y`);
    }
    return {
      id: obj.id,
      assetId: obj.assetId,
      x: obj.x,
      y: obj.y,
      rotationY: typeof obj.rotationY === 'number' ? obj.rotationY : 0,
      baseLocalY: typeof obj.baseLocalY === 'number' ? obj.baseLocalY : 0,
      parentId: typeof obj.parentId === 'string' ? obj.parentId : null,
      anchor: obj.anchor === 'stack' || obj.anchor === 'sea' ? obj.anchor : 'terrain',
    };
  });

  return {
    id,
    name,
    version: 3,
    citySize,
    terrain: /** @type {string[][]} */ (terrain),
    stackObjects,
  };
}

/**
 * @param {EditorMapLayout} layout
 * @returns {object}
 */
export function serializeEditorMapLayoutDocument(layout) {
  return {
    uuid: layout.id,
    name: layout.name,
    version: layout.version,
    citySize: layout.citySize,
    terrain: layout.terrain,
    stackObjects: layout.stackObjects.map((obj) => ({ ...obj })),
  };
}
