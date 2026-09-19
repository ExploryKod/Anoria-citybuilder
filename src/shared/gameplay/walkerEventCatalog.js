/**
 * Walker event catalog — single source of truth for which domain events
 * spawn a walker, data only.
 *
 * A walker never exists without a triggering event, and never has a
 * standing "role" of its own — its origin is whatever that event says it
 * is, not a static fact about a building type (contrast with how
 * buildingCatalog.js works: no `walker` fact lives there). Each entry here
 * says, for one event type:
 *   - walkerType: the logical kind of walker — a key of WALKER_TYPES in
 *     presentation/three/assets/walkerAssets.js, which declares which
 *     character models it can use (this file never names a model).
 *   - origin: which field on the event payload holds the journey's
 *     starting building instance id, and whether it requires road access.
 *
 * The walker's route itself is a there-and-back patrol along the road
 * network reachable from origin (see WalkerEventController /
 * roadNetworkPathfinder.js's `findFarthestRoadPath`) — Caesar 3-style: walk
 * to the farthest reachable point, then retrace the same path home. It
 * doesn't visit specific destinations; WHO actually got served this cycle
 * is a separate, already-settled economic fact (e.g. `consumerIds` on
 * `supply.resourceDeliveryRoute`, computed by round-robin) that the route
 * doesn't need to re-derive or guarantee visiting — the walker is a visual
 * patrol, not the delivery mechanism.
 *
 * Adding a new event-triggered walker is only ever: the owning bounded
 * context publishes an event with an origin id field (through the shared
 * event bus — composition/sharedEventBus.js), and one entry here. No
 * engine code changes.
 *
 * @typedef {Object} WalkerEventEndpoint
 * @property {string} field Event payload field holding the origin building's instance id.
 * @property {boolean} requiresRoad Whether the origin needs road access for a patrol to happen at all.
 *
 * @typedef {Object} WalkerEventDescriptor
 * @property {string} walkerType
 * @property {WalkerEventEndpoint} origin
 */

/** @type {Readonly<Record<string, WalkerEventDescriptor>>} */
export const WALKER_EVENT_CATALOG = Object.freeze({
  // One event per distributor PER CYCLE (see RunCityResourceCycle.js), not
  // per unit moved. `consumerIds` (every consumer actually reached this
  // cycle) rides along on the event as a factual record, but the walker's
  // route doesn't chain through them — see this file's own doc comment.
  'supply.resourceDeliveryRoute': Object.freeze({
    walkerType: 'citizen',
    origin: Object.freeze({ field: 'sourceId', requiresRoad: true }),
  }),
});

/**
 * @param {string} eventType
 * @returns {WalkerEventDescriptor | undefined}
 */
export function getWalkerEventDescriptor(eventType) {
  return WALKER_EVENT_CATALOG[eventType];
}
