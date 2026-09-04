/**
 * Housing BC — evaluates a tier's declarative `requirements` list (see
 * shared/population/socialCategoryCatalog.js) against a house's current
 * facts.
 *
 * One small lookup table, keyed by requirement `kind`, each entry a plain
 * function of (requirement, context) -> boolean. Adding a new requirement
 * kind later (e.g. a building that must exist nearby, a city-wide budget
 * threshold) means adding one function here and using it in the catalog —
 * nothing about how tiers are declared or resolved needs to change.
 *
 * An unrecognized `kind` fails closed (never silently satisfied), so a
 * catalog typo surfaces as "requirement never met" rather than "requirement
 * always met".
 */

/** @type {Readonly<Record<string, (requirement: object, context: object) => boolean>>} */
const REQUIREMENT_EVALUATORS = Object.freeze({
  roadAccess: (requirement, context) => (context.roadCount ?? 0) > 0,
  population: (requirement, context) => (context.pop ?? 0) >= (requirement.min ?? 0),
});

/**
 * @param {ReadonlyArray<{ kind: string }>} requirements
 * @param {{ pop?: number, roadCount?: number }} context
 * @returns {boolean}
 */
export function meetsTierRequirements(requirements, context) {
  if (!requirements || requirements.length === 0) return true;
  return requirements.every((requirement) => {
    const evaluate = REQUIREMENT_EVALUATORS[requirement.kind];
    return evaluate ? evaluate(requirement, context) : false;
  });
}
