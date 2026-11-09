import { RELATION_EVENT_KINDS, RELATION_RANGE, RELATION_TIERS, personalityOf } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * The memory between two States (docs/gameplay/PLAN_TRADE_RELATIONS.md): the relation with a partner is read from the journal of its events, never stored.
 *
 *   relation = Σ  weight(event) × fade(age)        clamped to RELATION_RANGE
 *
 * An event keeps the weight it was written with (the catalog's at that time); what falls is its share: the partner's memory loses `yearlyLoss` of it per year of age
 * down to its `residue`, which stays for ever (the journal is never purged, so the very old weighs little but never nothing).
 *
 * @typedef {{ cityId: string, kind: string, turn: number, year: number, monthIndex: number, weight: number, good?: string, flow?: 'export' | 'import', cause?: object }} RelationEvent
 */

/** The share of its weight an event of this age still has, for a partner's memory. @param {{ yearlyLoss: number, residue: number }} memory @param {number} ageYears @returns {number} */
export function fadeOf(memory, ageYears) {
  if (!Number.isFinite(ageYears) || ageYears < 0) throw new Error(`[trade] an event's age must be a number of years >= 0, got ${ageYears}`);
  return Math.max(memory.residue, 1 - memory.yearlyLoss * ageYears);
}

/** @param {number} score @returns {string} the step of the relation's scale the score reaches (TradeCatalog's RELATION_TIERS) */
export function relationTier(score) {
  let reached = null;
  for (const tier of RELATION_TIERS) if (score >= tier.from) reached = tier;
  if (!reached) throw new Error(`[trade] the relation ${score} is under the first step of RELATION_TIERS`);
  return reached.label;
}

/**
 * What the journal says of a relation at a turn.
 * @param {{ events: ReadonlyArray<RelationEvent>, entry: object, nowTurn: number, turnsPerYear: number }} reading
 * @returns {{ score: number, tier: string, events: Array<RelationEvent & { wording: string, currentWeight: number }> }} the events newest first, with what each still weighs
 */
export function readRelation({ events, entry, nowTurn, turnsPerYear }) {
  const { memory } = personalityOf(entry);
  const read = events.map((event) => {
    const kind = RELATION_EVENT_KINDS[event.kind];
    if (!kind) throw new Error(`[trade] the relation with ${event.cityId} holds an event of the kind "${event.kind}", which RELATION_EVENT_KINDS does not declare`);
    if (!Number.isFinite(event.weight)) throw new Error(`[trade] the event "${event.kind}" of ${event.cityId} has no weight`);
    return { ...event, wording: kind.wording, currentWeight: event.weight * fadeOf(memory, Math.max(0, nowTurn - event.turn) / turnsPerYear) };
  });
  const sum = read.reduce((total, event) => total + event.currentWeight, 0);
  const score = Math.max(RELATION_RANGE.min, Math.min(RELATION_RANGE.max, Math.round(sum)));
  return { score, tier: relationTier(score), events: read.sort((a, b) => b.turn - a.turn) };
}

/** The key of one embargo: a good, in one flow (the side of the trade). */
export const embargoKey = (flow, good) => `${flow}:${good}`;

/**
 * The embargoes the city has in force with a partner, read from its events: the last embargo event of each good and flow decides (decreed: in force, lifted: not).
 * Nothing else stores them.
 * @param {ReadonlyArray<RelationEvent>} events the events of one relation, oldest first
 * @returns {Set<string>} the `embargoKey`s in force
 */
export function embargoesIn(events) {
  const inForce = new Set();
  for (const event of events) {
    if (event.kind !== 'embargo_decreed' && event.kind !== 'embargo_lifted') continue;
    if (!event.good || !event.flow) throw new Error(`[trade] an embargo event of ${event.cityId} names no good or no flow`);
    const key = embargoKey(event.flow, event.good);
    if (event.kind === 'embargo_decreed') inForce.add(key);
    else inForce.delete(key);
  }
  return inForce;
}

/**
 * The embargoes the partner has on us in force at a turn, read from its events: each `partner_embargo_started` holds until the turn its cause names (`untilTurn`), no other event lifts it.
 * @param {ReadonlyArray<RelationEvent>} events @param {number} nowTurn
 * @returns {Set<string>} the `embargoKey`s in force (the flow is ours: `export` the partner no longer buys our good, `import` it no longer sells us its good)
 */
export function partnerEmbargoesIn(events, nowTurn) {
  const inForce = new Set();
  for (const event of events) {
    if (event.kind !== 'partner_embargo_started') continue;
    if (!event.good || !event.flow || !Number.isFinite(event.cause?.untilTurn)) throw new Error(`[trade] a partner embargo of ${event.cityId} names no good, no flow or no end`);
    if (event.cause.untilTurn > nowTurn) inForce.add(embargoKey(event.flow, event.good));
  }
  return inForce;
}

/**
 * The event our customs make, if any: the duty goes above the partner's tolerance (it takes it for a hostile act), or comes back under it after having.
 * It is an event of the change, once, never one per month the duty stays high.
 * @param {{ dutyRate: number, tolerance: number, wasAbove: boolean }} state
 * @returns {'customs_hostile' | 'customs_relieved' | null}
 */
export function customsMove({ dutyRate, tolerance, wasAbove }) {
  const above = dutyRate > tolerance;
  if (above && !wasAbove) return 'customs_hostile';
  if (!above && wasAbove) return 'customs_relieved';
  return null;
}
