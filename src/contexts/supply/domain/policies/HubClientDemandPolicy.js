/**
 * What the clients of a hub wanted, remembered on the hub so that a client served later in a tick is not
 * starved by one served earlier that ranks below it. Each client TYPE keeps `{ turn, wanted, served, streak }`
 * per good: the units it asked for and got in its latest tick, and for how many ticks in a row it has asked.
 *
 * A client that asks every tick (a market) is expected to ask again, so what it wanted last tick is held for it;
 * one that asks once (a monthly recipe) is expected only while it is still waiting, so only what it did not get.
 */

/**
 * @param {Record<string, { turn: number, wanted: number, served: number, streak: number }> | undefined} entries One good's memory.
 * @param {string} client
 * @param {number} turn
 * @param {number} wanted
 * @param {number} served
 */
export function recordClientDemand(entries, client, turn, wanted, served) {
  const previous = entries?.[client];
  if (previous?.turn === turn) {
    return { ...entries, [client]: { ...previous, wanted: previous.wanted + wanted, served: previous.served + served } };
  }
  const streak = previous && previous.turn === turn - 1 ? previous.streak + 1 : 1;
  return { ...entries, [client]: { turn, wanted, served, streak } };
}

/**
 * What every client OTHER than `client` still wants of a good at this tick.
 * @param {Record<string, { turn: number, wanted: number, served: number, streak: number }> | undefined} entries
 * @param {string} client
 * @param {number} turn
 * @returns {Record<string, number>}
 */
export function othersWanted(entries, client, turn) {
  const wanted = {};
  for (const [other, entry] of Object.entries(entries ?? {})) {
    if (other === client) continue;
    if (entry.turn === turn) wanted[other] = Math.max(0, entry.wanted - entry.served);
    else if (entry.turn === turn - 1) wanted[other] = entry.streak >= 2 ? entry.wanted : Math.max(0, entry.wanted - entry.served);
  }
  return wanted;
}
