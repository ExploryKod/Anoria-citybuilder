/**
 * Scarcity and glut move the price of what the houses eat (docs/gameplay/PLAN_CRISES.md). The food the city holds, against what the harvest to come was to bring, says whether
 * it is short or plentiful: the shortfall (or surplus) is read in MONTHS of what the citizens eat, against the stock the year's course expects (all the months until the
 * next harvest). A gap of a third of a year short is a price three times as high; a glut halves it. The retail price (the markets') follows; what the warehouses pay the farms
 * does not, so the middlemen's margin is what a shortage pays. First values, to tune by playing.
 *   - `slopeShort`: the price rises by this many times the shortfall as a share of a year;
 *   - `slopeGlut`: the price falls by this many times the surplus as a share of a year;
 *   - `floor`, `cap`: the factor on the price never goes outside them.
 * `SCARCE_NEEDS` names the needs it applies to, by the total key of their stock; the goods of a need are the categories its consumers declare.
 */
export const SCARCE_NEEDS = Object.freeze(['food']);
export const SCARCITY_RESPONSE = Object.freeze({ slopeShort: 6, slopeGlut: 2, floor: 0.5, cap: 3 });
