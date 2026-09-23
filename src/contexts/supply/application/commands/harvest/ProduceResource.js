import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  addCategoryAmount,
  getCategoryAmount,
  takeCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { isLockedForPeriod, buildLockUpdate } from '../../../domain/policies/PeriodLockPolicy.js';
import { getResourceRoles } from '../../../domain/policies/ResourceRolePolicy.js';
import {
  findNaturalSourcesInRange,
  isWithinRange,
  manhattanDistance,
} from '../../../domain/policies/ResourceRangePolicy.js';
import {
  getCategoriesForTotalKey,
  getTotalKeyForCategory,
} from '../../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Command: a building produces resource units into its own stock, gated by
 * each of its 'producer' entries' declarative `schedule` and `periodLock`
 * (see buildingEconomy.js / ResourceSchedulePolicy.js / PeriodLockPolicy.js).
 * Fully resource-agnostic — every fact about WHAT is produced, HOW MUCH,
 * WHEN, and the once-per-period lock comes from the building's own catalog
 * entries; this command never names a resource or a lock field itself.
 *
 * A building can hold several 'producer' entries (a house that gathers, a
 * workshop with two outputs); each is evaluated independently. Three catalog
 * facts refine an entry:
 *   - `scale: 'building' | 'population'` — an entry declaring `scale` belongs
 *     to inhabitants: it needs at least one, and `'population'` multiplies
 *     `amount` by their number (`'building'` = flat amount per building).
 *   - `requiresOperational: false` — lifts the road/staffing gate.
 *   - `inputs: [{ category, amount }]` — makes the entry a TRANSFORMATION
 *     rather than a source: it first takes those goods from the building's
 *     own stock, and produces nothing at all unless every one of them is
 *     there (a workshop idles without its raw material instead of
 *     half-producing). Which good, how much, and what it becomes are all
 *     catalog facts; this command still names none of them. An input with
 *     `from: { role, range }` is not read from the building's own stock but
 *     drawn from the nearest working buildings of that role (a warehouse hub)
 *     within `range` that hold the good, taken only once every input is there.
 *   - `cycle: [steps]` — the entry is a CHAIN of steps instead of one production. Each step is
 *     `{ id, when, amount | factor, inputs?, missed?, wait? }`: the first sets a base (`amount`), each
 *     next one multiplies the running value (`factor`), and the product is credited to the stock only
 *     when the last step is done. A step is done at the first working tick of its `when` window (an
 *     unstaffed building or a missing input cannot do it). A missed window multiplies by `missed`
 *     (0 voids the cycle, 1 ignores the step, in between degrades it); with `wait: true` the step can
 *     still be done after its window instead. Nothing in it names a good, a season or a building.
 *   - `source: { resource, range, consume }` — makes the entry a RAW-MATERIAL
 *     producer: it works only while enough natural resources of that kind lie
 *     within `range` tiles, and each production uses `consume` of them up
 *     (the nearest ones, removed from the game). No natural resource is named
 *     here. The player's "no resource" warning is not stored: it is derived
 *     from the same rule (see listNoResourceBuildingIds in createSupplyContext).
 * An entry with a `totalKey` writes through the full set of categories
 * filed under that aggregate, so the aggregate stays consistent and the
 * building's other goods are untouched.
 */
/**
 * The categories and aggregate a stock write about `category` must use, so
 * that the right total stays in sync: the entry's own `totalKey` when it
 * declares one, otherwise the aggregate the catalog files that good under
 * (the good itself when it belongs to none, e.g. pottery today). Used for
 * both sides of a transformation, so an input and an output are read and
 * written by the same rule.
 *
 * @param {string} category
 * @param {string} [declaredTotalKey]
 * @returns {{ categories: readonly string[], totalKey: string }}
 */
function stockShapeFor(category, declaredTotalKey) {
  const totalKey = declaredTotalKey ?? getTotalKeyForCategory(category);
  const filedUnder = getCategoriesForTotalKey(totalKey);
  return { categories: filedUnder.length > 0 ? filedUnder : [category], totalKey };
}

export class ProduceResource {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {{ removeBuilding?: (params: { instanceId: string }) => Promise<unknown> }} [deps]
   *   `removeBuilding` deletes a used-up natural resource from the game (Parcels owns
   *   building removal, so Supply is handed it rather than reaching into it).
   */
  constructor(supplyBuildingRepository, { removeBuilding } = {}) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.removeBuilding = removeBuilding ?? null;
  }


  /**
   * Where an input declared with `from` would be drawn from: the nearest working buildings of that role
   * within range holding the good, as `[{ holderId, category, amount }]`, or null when together they
   * cannot cover `need`. Nothing is taken here — the caller commits once every input is covered.
   */
  async #planDraw(building, input, need) {
    const { role, range = Infinity } = input.from;
    const holders = (await this.supplyBuildingRepository.findByResourceRole(role, input.category))
      .filter(
        (holder) =>
          holder.id !== building.id &&
          holder.x != null &&
          holder.y != null &&
          isWithinRange(building, holder, range) &&
          isOperational({
            type: holder.type,
            roadCount: holder.roadCount,
            worker: holder.worker,
            workerNeed: holder.workerNeed,
          })
      )
      .sort(
        (a, b) => manhattanDistance(building, a) - manhattanDistance(building, b) || a.id.localeCompare(b.id)
      );

    const draws = [];
    let left = need;
    for (const holder of holders) {
      const amount = Math.min(getCategoryAmount(holder.stocks, input.category), left);
      if (amount <= 0) continue;
      draws.push({ holderId: holder.id, category: input.category, amount });
      left -= amount;
      if (left <= 0) break;
    }
    return left <= 0 ? draws : null;
  }

  /**
   * Plan a set of recipe inputs: own-stock ones are checked in place, `from` ones drawn from holders in
   * range. All or nothing; nothing is taken here.
   * @returns {Promise<{ missing: boolean, ownInputs: object[], draws: object[] }>}
   */
  async #planInputs(building, inputs, need) {
    const ownInputs = inputs.filter((input) => !input.from);
    const draws = [];
    let missing = ownInputs.some((input) => getCategoryAmount(building.stocks, input.category) < need(input));
    for (const input of inputs.filter((candidate) => candidate.from)) {
      if (missing) break;
      const plan = await this.#planDraw(building, input, need(input));
      if (plan) draws.push(...plan);
      else missing = true;
    }
    return { missing, ownInputs, draws };
  }

  /** Take what #planInputs planned; returns the building's stock without its own inputs. */
  async #takeInputs(building, plan, need) {
    for (const draw of plan.draws) {
      const holder = await this.supplyBuildingRepository.findById(draw.holderId);
      const shape = stockShapeFor(draw.category);
      await this.supplyBuildingRepository.saveStocks(draw.holderId, {
        ...holder.stocks,
        ...takeCategoryAmount(holder.stocks, draw.category, draw.amount, shape.categories, shape.totalKey),
      });
    }
    let nextStock = building.stocks;
    for (const input of plan.ownInputs) {
      const shape = stockShapeFor(input.category);
      nextStock = {
        ...nextStock,
        ...takeCategoryAmount(nextStock, input.category, need(input), shape.categories, shape.totalKey),
      };
    }
    return nextStock;
  }

  /**
   * Advance a `cycle` entry by whatever this tick allows, and credit the finished product.
   * The state (`cycleState[category]`) is `{ index, value, opened }`: the step awaited, the running
   * product, and whether that step's window has been seen since the previous step was done.
   * @returns {Promise<{ building: object, credited: number }>}
   */
  async #advanceCycle(building, entry, category, period) {
    const steps = entry.cycle;
    const previous = building.cycleState?.[category];
    let state = { index: previous?.index ?? 0, value: previous?.value ?? 0, opened: previous?.opened === true };
    let credited = 0;
    let stock = building.stocks;
    const operational =
      entry.requiresOperational === false ||
      isOperational({
        type: building.type,
        roadCount: building.roadCount,
        worker: building.worker,
        workerNeed: building.workerNeed,
      });

    // A step done can open the next one in the same tick (a late step catching up), never more than one lap.
    for (let guard = 0; guard <= steps.length; guard += 1) {
      const step = steps[state.index];
      const open = !step.when || matchesSchedule(step.when, period);
      if (open) state.opened = true;

      let advanced = false;
      if (open || (step.wait === true && state.opened)) {
        const inputs = step.inputs ?? [];
        const need = (input) => input.amount ?? 0;
        const plan = operational ? await this.#planInputs({ ...building, stocks: stock }, inputs, need) : null;
        if (plan && !plan.missing) {
          stock = await this.#takeInputs({ ...building, stocks: stock }, plan, need);
          state.value = state.index === 0 ? (step.amount ?? 0) : state.value * (step.factor ?? 1);
          advanced = true;
        }
      } else if (state.opened && step.wait !== true) {
        // The window closed with the step undone.
        const missed = step.missed ?? 0;
        state.value = state.index === 0 ? (step.amount ?? 0) * missed : state.value * missed;
        advanced = true;
      }

      if (!advanced) break;
      state.index += 1;
      state.opened = false;
      if (state.index >= steps.length) {
        if (state.value > 0) {
          for (const produced of entry.categories) {
            const shape = stockShapeFor(produced, entry.totalKey);
            stock = { ...stock, ...addCategoryAmount(stock, produced, state.value, shape.categories, shape.totalKey) };
          }
          credited += state.value;
        }
        state = { index: 0, value: 0, opened: false };
      }
    }

    const changed =
      state.index !== (previous?.index ?? 0) ||
      state.value !== (previous?.value ?? 0) ||
      state.opened !== (previous?.opened === true);
    let next = building;
    if (stock !== building.stocks) {
      await this.supplyBuildingRepository.saveStocks(building.id, stock);
      next = { ...next, stocks: stock };
    }
    if (changed) {
      const cycleState = { ...building.cycleState, [category]: state };
      await this.supplyBuildingRepository.updateBuildingFields(building.id, { cycleState });
      next = { ...next, cycleState };
    }
    return { building: next, credited };
  }

  /**
   * @param {object} params
   * @param {string} params.buildingId
   * @param {object} params.period - time context (season, month, year, monthIndex, ...)
   * @returns {Promise<{
   *   produced: boolean,
   *   reason?: string,
   *   buildingId?: string,
   *   category?: string,
   *   amount?: number,
   * }>}
   */
  async execute({ buildingId, period }) {
    let building = await this.supplyBuildingRepository.findById(buildingId);
    if (!building) {
      return { produced: false, reason: 'building_not_found' };
    }

    const entries = getResourceRoles(building.type).filter((entry) => entry.role === 'producer');
    if (entries.length === 0 || !entries[0].categories?.[0]) {
      return { produced: false, reason: 'unknown_resource_category' };
    }

    const credited = {};
    let firstFailure = null;

    for (const entry of entries) {
      const category = entry.categories?.[0] ?? null;
      if (!category) {
        firstFailure ??= 'unknown_resource_category';
        continue;
      }

      // A raw-material producer needs its natural resource in range.
      let sources = [];
      const sourceNeed = entry.source ? (entry.source.consume ?? 1) : 0;
      if (entry.source) {
        sources = findNaturalSourcesInRange(
          building,
          await this.supplyBuildingRepository.listNaturalResources(),
          entry.source
        );
        if (sources.length < sourceNeed) {
          firstFailure ??= 'no_resource';
          continue;
        }
      }

      if (entry.cycle) {
        const outcome = await this.#advanceCycle(building, entry, category, period);
        building = outcome.building;
        if (outcome.credited > 0) {
          for (const produced of entry.categories) credited[produced] = (credited[produced] ?? 0) + outcome.credited;
        } else {
          firstFailure ??= 'cycle_in_progress';
        }
        continue;
      }

      if (!matchesSchedule(entry.schedule, period)) {
        firstFailure ??= 'not_production_period';
        continue;
      }

      if (
        entry.requiresOperational !== false &&
        !isOperational({
          type: building.type,
          roadCount: building.roadCount,
          worker: building.worker,
          workerNeed: building.workerNeed,
        })
      ) {
        firstFailure ??= 'not_operational';
        continue;
      }

      if (isLockedForPeriod(building, entry.periodLock, period, category)) {
        firstFailure ??= 'already_produced_this_period';
        continue;
      }

      let multiplier = 1;
      if (entry.scale) {
        const pop = Number.isFinite(building.pop) ? Math.max(0, Math.floor(building.pop)) : 0;
        if (pop <= 0) {
          firstFailure ??= 'no_population';
          continue;
        }
        if (entry.scale === 'population') multiplier = pop;
      }
      const amount = (entry.amount ?? 0) * multiplier;

      // A transformation: this entry turns goods the building already holds
      // into its own output. All or nothing — short of any one input it
      // produces nothing AND stays unlocked for the period, so it runs as
      // soon as it is supplied. The same `multiplier` scales the recipe, so
      // its ratio holds whatever scales the output.
      const inputNeed = (input) => (input.amount ?? 0) * multiplier;
      const plan = await this.#planInputs(building, entry.inputs ?? [], inputNeed);
      if (plan.missing) {
        firstFailure ??= 'missing_input';
        continue;
      }

      // Raw material: use up the nearest sources.
      for (const used of sources.slice(0, sourceNeed)) {
        await this.removeBuilding?.({ instanceId: used.id });
      }

      // Each write is merged back into the whole row: a write scoped to one
      // aggregate returns only that aggregate's fields, and a building that
      // holds a good outside it (its inputs, another chain's output) would
      // otherwise lose it on every production.
      let nextStock = await this.#takeInputs(building, plan, inputNeed);

      for (const produced of entry.categories) {
        const shape = stockShapeFor(produced, entry.totalKey);
        nextStock = {
          ...nextStock,
          ...addCategoryAmount(nextStock, produced, amount, shape.categories, shape.totalKey),
        };
        credited[produced] = (credited[produced] ?? 0) + amount;
      }

      await this.supplyBuildingRepository.saveStocks(buildingId, nextStock);

      const lockUpdate = entry.periodLock
        ? buildLockUpdate(building, entry.periodLock, period, category)
        : null;
      if (lockUpdate) {
        await this.supplyBuildingRepository.updateBuildingFields(buildingId, lockUpdate);
      }

      building = { ...building, stocks: nextStock, ...(lockUpdate ?? {}) };
    }

    const categories = Object.keys(credited);
    if (categories.length === 0) {
      return { produced: false, reason: firstFailure ?? 'unknown_resource_category' };
    }

    return {
      produced: true,
      buildingId,
      category: categories[0],
      amount: credited[categories[0]],
    };
  }
}
