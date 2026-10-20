import { isRoadType } from './roadQueries.js';
import { getResourceRoles, getNaturalResourceKind, getRoadRange, requiresRoad } from './resourceRoleQueries.js';
import { getBuildingDefinition } from './buildingCatalog.js';

/**
 * What a building reaches, read from the catalog alone — the mechanism behind the "range" mode.
 * No good, building or season is named here: only roles, categories and ranges the catalog declares.
 *
 * A building reaches:
 *  - the roads within the distance it needs to be connected (`roadRange`) or that a finite role
 *    range covers, measured from ANY tile of its footprint (like road access);
 *  - the buildings that receive what it gives, or give what it takes ('out' / 'in'), measured
 *    origin to origin like the supply engine does. An `Infinity` range reaches all of them.
 *
 * Who pulls decides the range: a distributor reaches the consumers within ITS range; a producer
 * is reached by the collectors and distributors whose range covers it.
 */

/** @typedef {{ instanceId: string, type: string, x: number, y: number, tiles: Array<{ x: number, y: number }> }} PlacedBuilding */


/**
 * The buildings placed on a city grid, one entry per instance (origin = its minimum corner).
 * Roads are returned apart: they are tiles to light, not buildings that serve.
 *
 * @param {{ size: number, tiles: object[][] }} city
 * @returns {{ buildings: PlacedBuilding[], roadTiles: Array<{ x: number, y: number }> }}
 */
export function listPlacedBuildings(city) {
  /** @type {Map<string, PlacedBuilding>} */
  const byInstance = new Map();
  const roadTiles = [];
  for (let x = 0; x < city.size; x += 1) {
    for (let y = 0; y < city.size; y += 1) {
      const tile = city.tiles?.[x]?.[y];
      if (!tile?.buildingId || !tile.instanceId) continue;
      if (isRoadType(tile.buildingId)) {
        roadTiles.push({ x, y });
        continue;
      }
      const placed = byInstance.get(tile.instanceId);
      if (placed) {
        placed.tiles.push({ x, y });
        // Columns come first, so the first tile met per column is the minimum corner.
        if (x < placed.x || (x === placed.x && y < placed.y)) {
          placed.x = x;
          placed.y = y;
        }
      } else {
        byInstance.set(tile.instanceId, { instanceId: tile.instanceId, type: tile.buildingId, x, y, tiles: [{ x, y }] });
      }
    }
  }
  return { buildings: [...byInstance.values()], roadTiles };
}

const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Manhattan distance from any tile of a footprint to a point (0 when the point is inside it). */
function footprintDistance(tiles, point) {
  let best = Infinity;
  for (const tile of tiles) best = Math.min(best, manhattan(tile, point));
  return best;
}

const sharesCategory = (a = [], b = []) => a.some((category) => b.includes(category));

/**
 * The role entries of a type that play `role`, optionally sharing a category.
 * @param {string} type
 * @param {string} role
 * @param {string[]} categories
 */
function entriesFor(type, role, categories) {
  return getResourceRoles(type).filter((entry) => entry.role === role && sharesCategory(entry.categories, categories));
}

/** The `from` clauses of a producer's cycle inputs: where a recipe draws what it consumes. */
function cycleInputSources(entry) {
  const sources = [];
  for (const step of entry.cycle ?? []) {
    for (const input of step.inputs ?? []) {
      if (input.from) sources.push({ category: input.category, ...input.from });
    }
  }
  return sources;
}

/**
 * @param {PlacedBuilding} origin
 * @param {PlacedBuilding[]} buildings Every placed building (the origin may be among them).
 * @param {Array<{ x: number, y: number }>} roadTiles
 * @returns {{ roads: Array<{ x: number, y: number }>, buildings: Array<{ instanceId: string, type: string, tiles: Array<{ x: number, y: number }>, direction: 'out' | 'in' }> }}
 */
export function computeBuildingReach(origin, buildings, roadTiles) {
  if (!getBuildingDefinition(origin.type)) {
    throw new Error(`[buildingReach] "${origin.type}" is not in the catalog`);
  }
  const roles = getResourceRoles(origin.type);
  const others = buildings.filter((b) => b.instanceId !== origin.instanceId);

  /** @type {Map<string, { building: PlacedBuilding, direction: 'out' | 'in' }>} */
  const reached = new Map();
  const reach = (building, direction) => {
    // Giving and taking at once shows as giving: it is the one the player asks about.
    if (!reached.has(building.instanceId) || direction === 'out') reached.set(building.instanceId, { building, direction });
  };

  let widestFiniteRange = requiresRoad(origin.type) ? getRoadRange(origin.type) : 0;
  // A role with no limit reaches the whole road network too.
  let reachesEveryRoad = false;

  for (const entry of roles) {
    const range = entry.range ?? Infinity;
    if (Number.isFinite(range)) widestFiniteRange = Math.max(widestFiniteRange, range);
    else if (entry.role === 'distributor' || entry.role === 'collector') reachesEveryRoad = true;

    for (const other of others) {
      const distance = manhattan(origin, other);

      if (entry.role === 'distributor') {
        if (distance <= range && entriesFor(other.type, 'consumer', entry.categories).length) reach(other, 'out');
        // The hub it may draw on: a hub of its goods within its hub link's range (and of the types it names).
        const link = entry.hubLink;
        if (link?.range != null && distance <= link.range && (!link.hubTypes || link.hubTypes.includes(other.type)) &&
            entriesFor(other.type, 'hub', entry.categories).length) {
          reach(other, 'in');
        }
      } else if (entry.role === 'collector') {
        if (distance <= range && entriesFor(other.type, 'producer', entry.categories).length) reach(other, 'in');
      } else if (entry.role === 'producer') {
        const pullers = [...entriesFor(other.type, 'collector', entry.categories), ...entriesFor(other.type, 'distributor', entry.categories)];
        if (pullers.some((puller) => distance <= (puller.range ?? Infinity))) reach(other, 'out');
      } else if (entry.role === 'consumer') {
        if (entriesFor(other.type, 'distributor', entry.categories).some((puller) => distance <= (puller.range ?? Infinity))) {
          reach(other, 'in');
        }
      } else if (entry.role === 'hub') {
        // A hub is drawn on by the buildings whose placement or recipe names a hub of its goods.
        const drawsOnHub = (from) => from.role === 'hub' && distance <= (from.range ?? Infinity) &&
          (from.categories == null || sharesCategory(from.categories, entry.categories));
        const linkedByOther = getResourceRoles(other.type).some(
          (candidate) =>
            candidate.role === 'distributor' && candidate.hubLink?.range != null && distance <= candidate.hubLink.range &&
            (!candidate.hubLink.hubTypes || candidate.hubLink.hubTypes.includes(origin.type)) &&
            sharesCategory(candidate.categories, entry.categories)
        );
        if (linkedByOther) reach(other, 'out');
        const requirements = getBuildingDefinition(other.type)?.placementRequires ?? [];
        const inputs = getResourceRoles(other.type).flatMap(cycleInputSources)
          .filter((from) => from.category == null || entry.categories.includes(from.category));
        if (requirements.some(drawsOnHub) || inputs.some(drawsOnHub)) reach(other, 'out');
      }
    }

    // What a producer draws on: natural resources around it, and hubs holding its recipe's inputs.
    if (entry.role === 'producer') {
      if (entry.source) {
        for (const other of others) {
          if (getNaturalResourceKind(other.type) === entry.source.resource && manhattan(origin, other) <= entry.source.range) {
            reach(other, 'in');
          }
        }
        if (Number.isFinite(entry.source.range)) widestFiniteRange = Math.max(widestFiniteRange, entry.source.range);
      }
      for (const from of cycleInputSources(entry)) {
        const fromRange = from.range ?? Infinity;
        if (Number.isFinite(fromRange)) widestFiniteRange = Math.max(widestFiniteRange, fromRange);
        for (const other of others) {
          if (manhattan(origin, other) > fromRange) continue;
          if (entriesFor(other.type, from.role, from.category ? [from.category] : entry.categories).length) reach(other, 'in');
        }
      }
    }
  }

  // What the building itself must be near to be placed (a market needs a hub in range).
  for (const requirement of getBuildingDefinition(origin.type)?.placementRequires ?? []) {
    const range = requirement.range ?? Infinity;
    if (Number.isFinite(range)) widestFiniteRange = Math.max(widestFiniteRange, range);
    for (const other of others) {
      if (manhattan(origin, other) <= range && entriesFor(other.type, requirement.role, requirement.categories).length) {
        reach(other, 'in');
      }
    }
  }

  const roads = reachesEveryRoad
    ? roadTiles
    : widestFiniteRange >= 1
    ? roadTiles.filter((road) => {
        const distance = footprintDistance(origin.tiles, road);
        return distance >= 1 && distance <= widestFiniteRange;
      })
    : [];

  return {
    roads,
    buildings: [...reached.values()].map(({ building, direction }) => ({
      instanceId: building.instanceId,
      type: building.type,
      tiles: building.tiles,
      direction,
    })),
  };
}
