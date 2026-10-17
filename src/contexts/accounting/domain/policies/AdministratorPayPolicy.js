/**
 * Whether the stipend the player pays each administrator keeps their house alive. An administrator is a citizen: a month of their house costs at
 * least the cost of living (see CostOfLivingPolicy.js). Under it, the house cannot pay its needs, its services are cut off and its tiers (so its
 * skills) stay out of reach. The stipend is compared as it is set (before the income tax it bears). The rent the house collects is not counted: it
 * goes to its business account, and the needs are paid from its personal one.
 * @param {{ stipend: number, costOfLiving: number | null }} params `costOfLiving` is null when a good nobody sells makes it unknown
 * @returns {{ known: boolean, tooLow: boolean, floor: number | null }} `known` false when the cost of living is not known: nothing is then judged
 */
export function administratorPayStatusOf({ stipend, costOfLiving }) {
  if (!Number.isFinite(stipend) || stipend < 0) throw new Error(`[administrators] the stipend must be a number of at least 0, got ${stipend}`);
  if (costOfLiving === null) return { known: false, tooLow: false, floor: null };
  if (!Number.isFinite(costOfLiving) || costOfLiving < 0) throw new Error(`[administrators] the cost of living must be a number of at least 0 or null, got ${costOfLiving}`);
  return { known: true, tooLow: stipend < costOfLiving, floor: costOfLiving };
}
