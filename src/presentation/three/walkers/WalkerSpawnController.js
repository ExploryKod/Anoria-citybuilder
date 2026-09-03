import * as THREE from 'three';
import { findShortestRoadPath } from '../../../shared/gameplay/roadNetworkPathfinder.js';
import { isWalkerOrigin, isWalkerDestination, walkerRequiresRoad } from '../../../shared/gameplay/walkerCatalogRoles.js';
import { InMemoryDomainEventPublisher } from '../../../contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { zoneBordersBuildings } from '../../../contexts/parcels/infrastructure/spatial/sceneNeighborhoodScan.js';

const WALK_SPEED = 2; // units per second, same pace as the legacy citizens

const IDLE_NAMES = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
const WALK_NAMES = ['walk', 'Walk', 'Walking', 'walking'];

function pickAnimation(animationsToUse, names) {
  return names.find((name) => animationsToUse[name]) ?? null;
}

function tileKey(tile) {
  return `${tile.x},${tile.y}`;
}

/**
 * Spawns a walker whenever a placed 'origin' building (see `walker.role` in
 * buildingEconomy.js) can reach a placed 'destination' building by road.
 *
 * Deliberately agnostic beyond that: it doesn't know what an origin or a
 * destination *means* (house→market today, anything else tomorrow — that's
 * a catalog edit, not a code change), and it doesn't run any game mechanic
 * on arrival yet — a walker just disappears when it reaches its target.
 * Wiring an `onArrive` effect is a later step once economy is back in
 * scope.
 *
 * Reuses the existing generic `InMemoryDomainEventPublisher` (from
 * contexts/parcels) rather than inventing a new one — it has zero
 * parcels-specific behavior, so it's safe to publish an unrelated event
 * type through the same instance.
 *
 * "Does this building have road access, and through which tile" is also
 * reused rather than reinvented: `zoneBordersBuildings` is the same scan
 * that already backs the Housing 'Voisins' panel and
 * RecalculateRoadAccessForBuilding, so a walker's origin/destination agree
 * with what the game already tells the player about road access — a plain
 * 4-neighbor "must literally touch" check disagreed with it (e.g. it
 * missed roads reachable within the game's real 2-tile access radius, or
 * diagonal-only touches) and produced origins that looked connected in the
 * UI but silently never spawned a walker.
 */
export function createWalkerSpawnController({ scene, citizenManager, citizenPathfinding, buildings, city, getCitySize, eventPublisher }) {
  const events = eventPublisher ?? new InMemoryDomainEventPublisher();

  /** @type {Map<string, { citizen: object, path: Array<{x:number,y:number}>, index: number, originKey: string }>} */
  const activeWalkers = new Map();
  /** Origin tiles that currently have a walker in transit, so a scan never double-spawns. */
  const busyOrigins = new Set();

  function buildingIdAt(x, y) {
    return buildings[x]?.[y]?.userData?.type;
  }

  /**
   * The nearest actual road tile within the building's road-access
   * neighborhood (same rule the rest of the game uses — see module doc),
   * or null if none is within range.
   */
  function findEntryRoadTile(tile) {
    const neighbors = zoneBordersBuildings({ buildings, city, x: tile.x, y: tile.y });
    const roadNeighbors = neighbors.filter((n) => n.isRoad);
    if (roadNeighbors.length === 0) return null;
    roadNeighbors.sort((a, b) => a.zone - b.zone);
    return { x: roadNeighbors[0].x, y: roadNeighbors[0].y };
  }

  /**
   * Resolves how a walker enters/exits a building tile, per its catalog
   * `walker.requiresRoad` fact (default true — see buildingCatalog.js):
   *   - requires road: the nearest road tile within access range, or null
   *     if there isn't one (this endpoint is unusable).
   *   - doesn't require road: the building tile itself — always usable,
   *     and it's not a road tile, so a leg touching it skips the road
   *     network (see `resolveJourney` below).
   *
   * @returns {{ tile: {x:number,y:number}, isRoadEntry: boolean } | null}
   */
  function resolveEntryPoint(buildingTile, buildingId) {
    if (!walkerRequiresRoad(buildingId)) {
      return { tile: buildingTile, isRoadEntry: false };
    }
    const road = findEntryRoadTile(buildingTile);
    return road ? { tile: road, isRoadEntry: true } : null;
  }

  /**
   * Full tile path for one origin→destination leg, or null if unreachable.
   * When both ends require road access, this is a real road-network walk.
   * When either end is flagged `requiresRoad: false`, that leg connects
   * directly (straight line) instead — off-road endpoints don't route
   * through the road graph at all.
   */
  function resolveJourney(origin, originEntry, destination, destinationEntry) {
    if (originEntry.isRoadEntry && destinationEntry.isRoadEntry) {
      const isRoadTile = citizenPathfinding.isRoadTile.bind(citizenPathfinding);
      const roadPath = findShortestRoadPath(originEntry.tile, destinationEntry.tile, isRoadTile);
      return roadPath ? [origin, ...roadPath, destination] : null;
    }
    return [origin, destination];
  }

  function collectTilesByRole(role) {
    const size = getCitySize();
    const predicate = role === 'origin' ? isWalkerOrigin : isWalkerDestination;
    const tiles = [];
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        if (predicate(buildingIdAt(x, y))) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  async function spawnWalker(originTile, destinationTile, path) {
    const citizen = await citizenManager.createCitizenInstance('citizen02');
    if (!citizen) return;

    citizen.character.position.set(path[0].x, 0.21, path[0].y);
    citizen.character.visible = true;
    scene.add(citizen.character);

    const animationsToUse = citizenManager.getCitizenAnimations(citizen);
    const walkAnimation = pickAnimation(animationsToUse, WALK_NAMES);
    if (walkAnimation) {
      citizenManager.switchCitizenAnimation(citizen, walkAnimation, true, 0.2);
    }

    const originKey = tileKey(originTile);
    busyOrigins.add(originKey);
    activeWalkers.set(originKey, { citizen, path, index: 0, originKey });
  }

  events.subscribe('walker.journeyRequested', (event) => {
    spawnWalker(event.origin, event.destination, event.path);
  });

  /**
   * Scans placed buildings for origins that can now reach a destination and
   * aren't already walking one. Call once per turn.
   */
  function scanForJourneys() {
    const origins = collectTilesByRole('origin');
    if (origins.length === 0) {
      console.debug('[WalkerSpawnController] scan: no origin buildings placed yet.');
      return;
    }
    const destinations = collectTilesByRole('destination');
    if (destinations.length === 0) {
      console.debug('[WalkerSpawnController] scan: no destination buildings placed yet.');
      return;
    }

    let spawned = 0;

    for (const origin of origins) {
      const originKey = tileKey(origin);
      if (busyOrigins.has(originKey)) {
        console.debug(`[WalkerSpawnController]   origin (${origin.x},${origin.y}): busy, walker already in transit.`);
        continue;
      }

      const originEntry = resolveEntryPoint(origin, buildingIdAt(origin.x, origin.y));
      if (!originEntry) {
        console.debug(`[WalkerSpawnController]   origin (${origin.x},${origin.y}): requires road access but none is within range.`);
        continue;
      }

      let shortestPath = null;
      let shortestDestination = null;
      for (const destination of destinations) {
        const destinationEntry = resolveEntryPoint(destination, buildingIdAt(destination.x, destination.y));
        if (!destinationEntry) continue;

        const fullPath = resolveJourney(origin, originEntry, destination, destinationEntry);
        if (fullPath && (!shortestPath || fullPath.length < shortestPath.length)) {
          shortestPath = fullPath;
          shortestDestination = destination;
        }
      }

      if (shortestPath) {
        spawned += 1;
        console.debug(`[WalkerSpawnController]   origin (${origin.x},${origin.y}): journey found to (${shortestDestination.x},${shortestDestination.y}), ${shortestPath.length} tiles.`);
        events.publish({
          type: 'walker.journeyRequested',
          origin,
          destination: shortestDestination,
          path: shortestPath,
        });
      } else {
        console.debug(`[WalkerSpawnController]   origin (${origin.x},${origin.y}): no route reaches any destination.`);
      }
    }

    console.debug(`[WalkerSpawnController] scan: ${origins.length} origin(s), ${destinations.length} destination(s), ${spawned} journey(s) requested.`);
  }

  function arriveAndDespawn(walker) {
    const { citizen, originKey } = walker;
    if (citizen.character.parent) {
      citizen.character.parent.remove(citizen.character);
    }
    activeWalkers.delete(originKey);
    busyOrigins.delete(originKey);
  }

  function update(deltaTime) {
    for (const walker of activeWalkers.values()) {
      const { citizen, path } = walker;
      if (citizen.mixer) {
        citizen.mixer.update(deltaTime);
      }

      const target = path[walker.index + 1];
      if (!target) {
        arriveAndDespawn(walker);
        continue;
      }

      const currentPos = citizen.character.position;
      const targetPos = new THREE.Vector3(target.x, 0.21, target.y);
      const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
      const distance = direction.length();

      if (distance < 0.05) {
        currentPos.copy(targetPos);
        walker.index += 1;
        continue;
      }

      direction.normalize();
      currentPos.add(direction.multiplyScalar(Math.min(WALK_SPEED * deltaTime, distance)));
      citizen.character.rotation.y = Math.atan2(direction.x, direction.z);
    }
  }

  return { scanForJourneys, update, events };
}
