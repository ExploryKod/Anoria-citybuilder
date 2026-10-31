import { listTileDeposits } from '../../../shared/building-catalog/depositQueries.js';
import { getColumnTopLocalY } from '../../../shared/editor-catalog/kenneyPlacementProfile.js';
import { propRecordSpec, seededRockPropIds, seededTreePropIds } from '../../../shared/editor-catalog/naturePropCatalog.js';

/** Ground a tree or a rock can stand on: grass that is flat and clear (no slope, cliff face, or piece of the map already in the way). */
function isOpenGround(tile) {
  return tile.terrainId === 'grass' && (!tile.relief || (tile.relief.flat && !tile.relief.obstacle));
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * The nature of a new hamlet, generated at random: trees (5 % of the tiles) and rocks (3 %), each a piece of the map like any piece a map file sets —
 * a prop with its coordinates, and the record of the hamlet that says what it holds. Nothing on the grid is decor.
 *
 * @param {object} city
 * @returns {Array<{ piece: { id: string, assetId: string, x: number, y: number, rotationY: number, baseLocalY: number, parentId: null, anchor: 'terrain' }, type: string, stocks: Record<string, number> }>}
 */
export function generateNaturePieces(city) {
  const taken = new Set();
  const items = [];
  const treeIds = seededTreePropIds();
  const rockIds = seededRockPropIds();

  const scatter = (count, propIds, stocksOf) => {
    let placed = 0;
    while (placed < count) {
      const x = Math.floor(Math.random() * city.size);
      const y = Math.floor(Math.random() * city.size);
      const tile = city.tiles[x]?.[y];
      if (!tile || tile.buildingId || taken.has(`${x},${y}`) || !isOpenGround(tile)) continue;
      taken.add(`${x},${y}`);
      const assetId = pick(propIds);
      const spec = propRecordSpec(assetId);
      items.push({
        piece: {
          // Each piece of the stack has its own id (the scene puts one mesh per id) and stands on the ground of its tile
          id: `nature-${x}-${y}`,
          assetId,
          x,
          y,
          rotationY: Math.floor(Math.random() * 4) * (Math.PI / 2),
          baseLocalY: getColumnTopLocalY([], x, y, tile.terrainId),
          parentId: null,
          anchor: 'terrain',
        },
        type: spec.type,
        stocks: stocksOf(spec),
      });
      placed += 1;
    }
  };

  // What a piece holds is what its kind holds (the large rocks hide iron, the tall ones gold, see `propRecordSpec`): the model drawn is what decides
  scatter(Math.floor(city.size * city.size * 0.05), treeIds, (spec) => ({ ...spec.stocks }));
  scatter(Math.floor(city.size * city.size * 0.03), rockIds, (spec) => ({ ...spec.stocks }));
  return items;
}

/** Scatter the deposits the catalog says the ground carries (each on its declared share of its terrain's tiles). */
export function markDepositTiles(city) {
  for (const { terrain, kind, share } of listTileDeposits()) {
    const count = Math.floor(city.size * city.size * share);

    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * city.size);
      const y = Math.floor(Math.random() * city.size);
      const tile = city.tiles[x]?.[y];

      if (tile && tile.terrainId === terrain) {
        tile.deposits = { ...(tile.deposits ?? {}), [kind]: true };
      }
    }
  }
}
