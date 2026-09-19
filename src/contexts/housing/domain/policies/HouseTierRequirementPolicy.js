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
  // A house is "covered" by a service (e.g. a chapel's faith service) for
  // `requirement.coveragePeriods` periods after the service's own supply
  // cycle last marked it served — see Supply's `servedFlags`
  // (contexts/supply/domain/policies/PeriodLockPolicy.js) and
  // DistributeResourceToConsumers.js. Which service — `requirement.category`
  // — is the only thing that varies per tier; this descriptor has no idea
  // "faith"/"chapel"/any service name exists, only "a category key". Two
  // catalog numbers now govern difficulty independently: the distributor's
  // own `schedule` (how often it attempts to visit — Supply-side) and
  // `coveragePeriods` here (how many periods a visit's flag stays valid
  // before the requirement is considered unmet again) — see
  // docs/service-coverage.md "Coverage window".
  //
  // `coveragePeriods` is deliberately REQUIRED with no code-side default: a
  // tier that declares `serviceCoverage` without it is a catalog authoring
  // mistake, not a valid "use the default" case, so it fails loud
  // (`console.error` naming the category) as well as closed (`met: false`)
  // rather than silently falling back to some code-chosen number.
  // `Number.isFinite(context.periodKey)` guards against a missing periodKey
  // vacuously satisfying the check (`undefined === undefined`) — a caller
  // that forgot to pass the current period must fail closed, not pass.
  serviceCoverage: (requirement, context) => {
    const { coveragePeriods } = requirement;
    if (!Number.isFinite(coveragePeriods) || coveragePeriods <= 0) {
      console.error(
        `[HouseTierRequirementPolicy] serviceCoverage requirement for category "${requirement.category}" is missing a valid "coveragePeriods" in socialCategoryCatalog.js — treating as unmet.`,
      );
      return { current: 0, target: 1, met: false };
    }
    const servedAt = context.servedFlags?.[requirement.category];
    const met =
      Number.isFinite(context.periodKey) &&
      Number.isFinite(servedAt) &&
      context.periodKey - servedAt < coveragePeriods;
    return { current: met ? 1 : 0, target: 1, met };
  },
  // A house's demand for its quantity-consumed good was fully met THIS
  // period — see ConsumeResource.js's `lastConsumption`
  // (`{ month, totalUnfed, ... }`). Deliberately named for "a good" in
  // general, not "food": a house's `resourceRoles` can declare any
  // 'consumer'/'quantity' good (food today; a future pottery, wood,
  // furniture, ... would work identically) — this descriptor has no idea
  // which one it is. Same freshness guard as `serviceCoverage`: stale or
  // missing `lastConsumption` fails closed.
  //
  // Scope note: a house currently holds at most ONE quantity-consumer
  // role, so `lastConsumption` is a single flat record (matching
  // `periodLock: { field, unit }`'s "one dedicated field" mode). If a
  // house type is ever given a SECOND quantity-consumed good at once, this
  // field would need the same "one field, many keys" generalization
  // `servedFlags` already has for flag-mode services — not needed today,
  // and deliberately not built ahead of that real need (this field is also
  // read by famine/population-growth code well outside this file's scope,
  // so that generalization is a separate, larger change).
  demandMet: (requirement, context) => {
    const met =
      Number.isFinite(context.periodKey) &&
      context.lastConsumption?.month === context.periodKey &&
      context.lastConsumption?.totalUnfed === 0;
    return { current: met ? 1 : 0, target: 1, met };
  },
  // At least `requirement.min` distinct categories of that same good were
  // drawn from THIS period (e.g. both `wheat` and `carrot`, not just one —
  // or, for a future good, both `pot` and `amphore`) — see
  // ConsumeResource.js's `lastConsumption.categoriesTaken`. Same scope note
  // as `demandMet` above. A stale or missing `lastConsumption` reports 0.
  goodsVariety: (requirement, context) => {
    const fresh = Number.isFinite(context.periodKey) && context.lastConsumption?.month === context.periodKey;
    const current = fresh ? (context.lastConsumption?.categoriesTaken?.length ?? 0) : 0;
    const target = requirement.min ?? 0;
    return { current, target, met: current >= target };
  },
});

/**
 * Spreads the ORIGINAL requirement object first (so a kind-specific field
 * like `serviceCoverage`'s `category` or `population`'s `min` rides along
 * automatically for any caller that needs it — e.g. a UI chip naming which
 * service is missing) then the descriptor's computed fields on top.
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
    return { ...requirement, ...described };
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
