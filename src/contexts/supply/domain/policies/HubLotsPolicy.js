/**
 * A hub's stock, told by where it came from: for each good, how much each producer TYPE delivered. The stock
 * itself stays what it was (per good, and its aggregate); the lots are the breakdown of it, so the hub can
 * serve its clients in the order each producer type asks for.
 *
 * A stock the lots do not account for (a save from before lots, goods added by a cheat) is the
 * "unattributed" lot: it belongs to nobody in particular and serves every client alike.
 */

/** The key of the unattributed lot. */
export const UNATTRIBUTED = '';

/**
 * Make lots agree with the stock they break down: what the lots miss goes to the unattributed lot, what they
 * overshoot is trimmed (unattributed first, then the other lots in key order).
 * @param {Record<string, number> | null | undefined} lots
 * @param {number} stockAmount What the hub holds of the good.
 * @returns {Record<string, number>}
 */
export function reconcileLots(lots, stockAmount) {
  const stock = Math.max(0, Math.floor(Number(stockAmount) || 0));
  const next = {};
  for (const [key, amount] of Object.entries(lots ?? {})) {
    const whole = Math.max(0, Math.floor(Number(amount) || 0));
    if (whole > 0) next[key] = whole;
  }

  let sum = Object.values(next).reduce((total, amount) => total + amount, 0);
  if (sum < stock) {
    next[UNATTRIBUTED] = (next[UNATTRIBUTED] ?? 0) + (stock - sum);
    return next;
  }
  for (const key of [UNATTRIBUTED, ...Object.keys(next).filter((k) => k !== UNATTRIBUTED).sort()]) {
    if (sum <= stock) break;
    const trim = Math.min(next[key] ?? 0, sum - stock);
    if (trim <= 0) continue;
    next[key] -= trim;
    sum -= trim;
    if (next[key] === 0) delete next[key];
  }
  return next;
}

/**
 * @param {Record<string, number>} lots
 * @param {string} key The producer type that delivered.
 * @param {number} amount
 * @returns {Record<string, number>}
 */
export function addToLot(lots, key, amount) {
  return { ...lots, [key]: (lots[key] ?? 0) + Math.max(0, Math.floor(amount)) };
}

/**
 * @param {Record<string, number>} lots
 * @param {Array<{ key: string, amount: number }>} takes
 * @returns {Record<string, number>}
 */
export function takeFromLots(lots, takes) {
  const next = { ...lots };
  for (const { key, amount } of takes) {
    next[key] = Math.max(0, (next[key] ?? 0) - amount);
    if (next[key] === 0) delete next[key];
  }
  return next;
}
