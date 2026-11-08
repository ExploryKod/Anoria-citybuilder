/**
 * The solidity of a building (docs/gameplay/PLAN_COLLAPSE.md): a bar from 0 to `SOLIDITY_MAX`, full when the building is built. Every month it loses `MONTHLY_WEAR`;
 * the upkeep paid that month cancels the loss, an upkeep not paid (the State's too, when its Treasury is empty) leaves it. Under `WARNING_BELOW` the building wears the
 * alert sprite (a few months before the risk); under `RISK_BELOW` it may collapse each month, the chance rising linearly to `MAX_MONTHLY_COLLAPSE_CHANCE` at 0. A collapse
 * kills `CASUALTY_SHARE` of the people inside. First values, to tune by playing.
 */
export const SOLIDITY_MAX = 100;
export const MONTHLY_WEAR = 4;
export const WARNING_BELOW = 25;
export const RISK_BELOW = 15;
export const MAX_MONTHLY_COLLAPSE_CHANCE = 0.5;
export const CASUALTY_SHARE = 0.25;

/** The kinds of building that have no solidity: a road and the nature are not built to last, or to be kept up (BuildingKind.js). */
export const KINDS_WITHOUT_SOLIDITY = Object.freeze(['road', 'nature']);
