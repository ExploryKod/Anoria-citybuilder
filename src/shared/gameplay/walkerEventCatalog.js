/**
 * Walker event catalog — single source of truth for which domain events
 * spawn a walker, data only.
 *
 * A walker never exists without a triggering event, and never has a
 * standing "role" of its own — origin/destination are whatever that event
 * says they are, not a static fact about a building type (contrast with
 * how buildingCatalog.js works: no `walker` fact lives there). Each entry
 * here says, for one event type:
 *   - walkerType: which visual/animation set to use (see CitizenManager's
 *     citizenType for the ids in use today).
 *   - origin / destination: which field on the event payload holds that
 *     side's building instance id, and whether that side requires road
 *     access (see WalkerEventController for how that's resolved — reusing
 *     the same road-access scan the rest of the game already uses).
 *
 * Adding a new event-triggered walker is only ever: the owning bounded
 * context publishes an event with two id fields (through the shared event
 * bus — composition/sharedEventBus.js), and one entry here. No engine code
 * changes.
 *
 * @typedef {Object} WalkerEventEndpoint
 * @property {string} field Event payload field holding this side's building instance id.
 * @property {boolean} requiresRoad Whether this side needs road access for the journey to happen.
 *
 * @typedef {Object} WalkerEventDescriptor
 * @property {string} walkerType
 * @property {WalkerEventEndpoint} origin
 * @property {WalkerEventEndpoint} destination
 */

/** @type {Readonly<Record<string, WalkerEventDescriptor>>} */
export const WALKER_EVENT_CATALOG = Object.freeze({
  'supply.resourceDelivered': Object.freeze({
    walkerType: 'citizen02',
    origin: Object.freeze({ field: 'sourceId', requiresRoad: true }),
    destination: Object.freeze({ field: 'consumerId', requiresRoad: true }),
  }),
});

/**
 * @param {string} eventType
 * @returns {WalkerEventDescriptor | undefined}
 */
export function getWalkerEventDescriptor(eventType) {
  return WALKER_EVENT_CATALOG[eventType];
}
