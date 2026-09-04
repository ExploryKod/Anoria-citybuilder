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

/**
 * One table, keyed by requirement `kind`: each entry describes the
 * requirement against a context — met/not, plus the current vs. target
 * numbers a UI needs to render "3/1 ✓" style progress. `meetsTierRequirements`
 * is just `every(item => item.met)` over this — one source of truth, not two
 * parallel tables that can drift.
 *
 * @type {Readonly<Record<string, (requirement: object, context: object) => { current: number, target: number, met: boolean }>>}
 */
const REQUIREMENT_DESCRIPTORS = Object.freeze({
  roadAccess: (requirement, context) => {
    const current = context.roadCount ?? 0;
    return { current, target: 1, met: current > 0 };
  },
  population: (requirement, context) => {
    const current = context.pop ?? 0;
    const target = requirement.min ?? 0;
    return { current, target, met: current >= target };
  },
});

/**
 * @param {ReadonlyArray<{ kind: string }>} requirements
 * @param {{ pop?: number, roadCount?: number }} context
 * @returns {ReadonlyArray<{ kind: string, current: number, target: number, met: boolean }>}
 */
export function describeTierRequirements(requirements, context) {
  if (!requirements) return [];
  return requirements.map((requirement) => {
    const describe = REQUIREMENT_DESCRIPTORS[requirement.kind];
    const described = describe
      ? describe(requirement, context)
      : { current: 0, target: 0, met: false };
    return { kind: requirement.kind, ...described };
  });
}

/**
 * @param {ReadonlyArray<{ kind: string }>} requirements
 * @param {{ pop?: number, roadCount?: number }} context
 * @returns {boolean}
 */
export function meetsTierRequirements(requirements, context) {
  if (!requirements || requirements.length === 0) return true;
  return describeTierRequirements(requirements, context).every((item) => item.met);
}
