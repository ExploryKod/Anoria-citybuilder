import { UNATTRIBUTED } from './HubLotsPolicy.js';

/**
 * Who gets a hub's goods first. Each lot (goods delivered by one producer type) carries that producer type's
 * priorities: the order in which the client types are served, and the ones it does not serve at all. Clients
 * are served in rank order, and what a higher-ranked client leaves is offered to the next — nothing is held
 * back for nobody, so a stock never sits unused while a client waits.
 *
 * Pure: given the lots, each lot's priorities, and how much each client still wants, it says what one client
 * may take.
 *
 * Among the lots a client may take, the cheapest is served first (`priceOf`, the unit price each lot entered the hub at): a good made here and the same good imported compete on
 * their price, whatever their origin. A lot whose price cannot be told is served after the ones that have one, then by key; when no price is given at all, by key.
 */

/**
 * @param {Record<string, number>} lots
 * @param {((lotKey: string) => number | null) | undefined} priceOf
 * @returns {string[]} the lot keys, cheapest first
 */
export function orderedLotKeys(lots, priceOf) {
  const keys = Object.keys(lots).sort();
  if (!priceOf) return keys;
  const price = (key) => {
    const value = key === UNATTRIBUTED ? null : priceOf(key);
    return Number.isFinite(value) ? value : Infinity;
  };
  return keys.sort((a, b) => (price(a) === price(b) ? 0 : price(a) < price(b) ? -1 : 1));
}

/**
 * @typedef {{ order: string[], disabled: string[] }} ClientPriorities
 */

/**
 * @param {Record<string, number>} lots Units per lot key (a producer type, or UNATTRIBUTED).
 * @param {(lotKey: string) => ClientPriorities} priorityOf The priorities a lot carries.
 * @param {Record<string, number>} wanted Units each client type still wants (the asking client included).
 * @param {string[]} [keys] The lots in the order they are served (see `orderedLotKeys`); by key when omitted.
 * @returns {{ entitled: Record<string, Record<string, number>>, free: Record<string, number> }}
 *   What each client is served from each lot in rank order, and what is left in each lot after them.
 */
export function planAllocation(lots, priorityOf, wanted, keys = Object.keys(lots).sort()) {
  const left = { ...lots };
  const remaining = { ...wanted };
  const entitled = {};

  const profiles = Object.fromEntries(keys.map((key) => [key, key === UNATTRIBUTED ? { order: [], disabled: [] } : priorityOf(key)]));
  const depth = Math.max(0, ...keys.map((key) => profiles[key].order.length));

  for (let rank = 0; rank < depth; rank += 1) {
    for (const key of keys) {
      const client = profiles[key].order[rank];
      if (client === undefined || profiles[key].disabled.includes(client)) continue;
      const take = Math.min(remaining[client] ?? 0, left[key]);
      if (take <= 0) continue;
      entitled[key] = { ...(entitled[key] ?? {}), [client]: (entitled[key]?.[client] ?? 0) + take };
      remaining[client] -= take;
      left[key] -= take;
    }
  }
  return { entitled, free: left };
}

/**
 * What one client takes from a hub's lots for `want` units: first what its rank entitles it to, then what
 * nobody ranked above it left (a lot that does not serve this client is closed to it).
 *
 * @param {object} params
 * @param {Record<string, number>} params.lots
 * @param {(lotKey: string) => ClientPriorities} params.priorityOf
 * @param {Record<string, number>} params.othersWanted What the OTHER clients still want.
 * @param {string} params.client The asking client type.
 * @param {number} params.want
 * @param {(lotKey: string) => number | null} [params.priceOf] The unit price a lot entered the hub at: the cheapest lot is served first.
 * @returns {Array<{ key: string, amount: number }>} What to take, per lot.
 */
export function allocateToClient({ lots, priorityOf, othersWanted, client, want, priceOf }) {
  const keys = orderedLotKeys(lots, priceOf);
  const { entitled, free } = planAllocation(lots, priorityOf, { ...othersWanted, [client]: want }, keys);
  const takes = [];
  let left = Math.max(0, Math.floor(want));

  for (const key of keys) {
    const amount = Math.min(entitled[key]?.[client] ?? 0, left);
    if (amount > 0) {
      takes.push({ key, amount });
      left -= amount;
    }
  }
  for (const key of keys) {
    if (left <= 0) break;
    const closed = key !== UNATTRIBUTED && priorityOf(key).disabled.includes(client);
    const amount = closed ? 0 : Math.min(free[key] ?? 0, left);
    if (amount > 0) {
      takes.push({ key, amount });
      left -= amount;
    }
  }
  return takes;
}

/**
 * How much a client could take at most from these lots right now (what `allocateToClient` would give it if it
 * asked for everything).
 */
export function availableToClient({ lots, priorityOf, othersWanted, client, priceOf }) {
  const total = Object.values(lots).reduce((sum, amount) => sum + amount, 0);
  return allocateToClient({ lots, priorityOf, othersWanted, client, want: total, priceOf }).reduce((sum, take) => sum + take.amount, 0);
}
