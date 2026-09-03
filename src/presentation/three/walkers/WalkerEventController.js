import * as THREE from 'three';
import { findShortestRoadPath } from '../../../shared/gameplay/roadNetworkPathfinder.js';
import { WALKER_EVENT_CATALOG } from '../../../shared/gameplay/walkerEventCatalog.js';
import { resolveTileByInstanceId } from '../../../shared/gameplay/resolveTileByInstanceId.js';
import { zoneBordersBuildings } from '../../../contexts/parcels/infrastructure/spatial/sceneNeighborhoodScan.js';

const WALK_SPEED = 2; // units per second, same pace as the legacy citizens

const WALK_NAMES = ['walk', 'Walk', 'Walking', 'walking'];

function pickAnimation(animationsToUse, names) {
  return names.find((name) => animationsToUse[name]) ?? null;
}

let nextWalkerId = 0;

/**
 * Spawns a walker in reaction to a domain event, per `WALKER_EVENT_CATALOG`
 * (shared/gameplay/walkerEventCatalog.js) — the only source of truth for
 * which events spawn a walker and where its origin/destination/road
 * requirement come from. This controller never scans the map for
 * "walker-capable" buildings and never hardcodes an event type: it
 * subscribes generically to every event type the catalog declares, so a
 * new event-triggered walker is a catalog edit plus the owning bounded
 * context publishing an event — no engine change here.
 *
 * It doesn't run any game mechanic on arrival yet — a walker just
 * despawns when it reaches its target. Wiring an arrival effect is a
 * later step.
 *
 * "Does this building have road access, and through which tile" reuses
 * `zoneBordersBuildings` — the same scan that already backs the Housing
 * 'Voisins' panel and RecalculateRoadAccessForBuilding — so a walker's
 * road requirement agrees with what the game already tells the player.
 */
export function createWalkerEventController({ scene, citizenManager, citizenPathfinding, buildings, city, eventPublisher }) {
  if (!eventPublisher) {
    throw new Error('[WalkerEventController] eventPublisher is required — walkers only exist in reaction to domain events.');
  }

  /** @type {Map<number, { citizen: object, path: Array<{x:number,y:number}>, index: number, walkerId: number }>} */
  const activeWalkers = new Map();

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
   * Resolves how a walker enters/exits a building tile, per the event
   * descriptor's `requiresRoad` for that side:
   *   - requires road: the nearest road tile within access range, or null
   *     if there isn't one (this endpoint is unusable).
   *   - doesn't require road: the building tile itself — always usable,
   *     and not a road tile, so a leg touching it skips the road network.
   *
   * @returns {{ tile: {x:number,y:number}, isRoadEntry: boolean } | null}
   */
  function resolveEntryPoint(buildingTile, requiresRoad) {
    if (!requiresRoad) {
      return { tile: buildingTile, isRoadEntry: false };
    }
    const road = findEntryRoadTile(buildingTile);
    return road ? { tile: road, isRoadEntry: true } : null;
  }

  /**
   * Full tile path for one origin→destination journey, or null if
   * unreachable. When both ends require road access, this is a real
   * road-network walk. When either end skips the road requirement, that
   * leg connects directly (straight line) instead.
   */
  function resolveJourney(origin, originEntry, destination, destinationEntry) {
    if (originEntry.isRoadEntry && destinationEntry.isRoadEntry) {
      const isRoadTile = citizenPathfinding.isRoadTile.bind(citizenPathfinding);
      const roadPath = findShortestRoadPath(originEntry.tile, destinationEntry.tile, isRoadTile);
      return roadPath ? [origin, ...roadPath, destination] : null;
    }
    return [origin, destination];
  }

  // Only one visual set ('citizen02') is wired today, so `walkerType` is
  // accepted but not yet used to pick a model — see WALKER_EVENT_CATALOG's
  // doc comment. Once more exist, this becomes the lookup point.
  async function spawnWalker(_walkerType, path) {
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

    const walkerId = nextWalkerId;
    nextWalkerId += 1;
    activeWalkers.set(walkerId, { citizen, path, index: 0, walkerId });
  }

  function handleWalkerEvent(eventType, descriptor, event) {
    const originId = event[descriptor.origin.field];
    const destinationId = event[descriptor.destination.field];

    const origin = resolveTileByInstanceId(city, originId);
    const destination = resolveTileByInstanceId(city, destinationId);
    if (!origin || !destination) {
      console.debug(`[WalkerEventController] ${eventType}: could not resolve origin/destination tile (origin=${originId}, destination=${destinationId}).`);
      return;
    }

    const originEntry = resolveEntryPoint(origin, descriptor.origin.requiresRoad);
    if (!originEntry) {
      console.debug(`[WalkerEventController] ${eventType}: origin (${origin.x},${origin.y}) requires road access but none is within range.`);
      return;
    }

    const destinationEntry = resolveEntryPoint(destination, descriptor.destination.requiresRoad);
    if (!destinationEntry) {
      console.debug(`[WalkerEventController] ${eventType}: destination (${destination.x},${destination.y}) requires road access but none is within range.`);
      return;
    }

    const path = resolveJourney(origin, originEntry, destination, destinationEntry);
    if (!path) {
      console.debug(`[WalkerEventController] ${eventType}: no route from (${origin.x},${origin.y}) to (${destination.x},${destination.y}).`);
      return;
    }

    spawnWalker(descriptor.walkerType, path);
  }

  for (const [eventType, descriptor] of Object.entries(WALKER_EVENT_CATALOG)) {
    eventPublisher.subscribe(eventType, (event) => handleWalkerEvent(eventType, descriptor, event));
  }

  function arriveAndDespawn(walker) {
    const { citizen, walkerId } = walker;
    if (citizen.character.parent) {
      citizen.character.parent.remove(citizen.character);
    }
    activeWalkers.delete(walkerId);
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

  return { update };
}
