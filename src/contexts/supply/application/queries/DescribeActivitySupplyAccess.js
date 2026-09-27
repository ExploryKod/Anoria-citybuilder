/**
 * Query (CQRS read): why a building's own recipe (a house's business, a workshop's) cannot even ask for one
 * of its inputs — a STRUCTURAL gap, true regardless of the tick's own timing, as opposed to
 * `activityShortfall` (set by ProduceResource each tick: "the goods just are not there yet"). Two kinds:
 *   - 'no-hub': no operational holder of the input's role (a warehouse, a windmill…) sits within its range —
 *     the recipe cannot reach anything to ask.
 *   - 'no-supplier': a holder IS reachable, but no operational 'producer' of that good exists anywhere in the
 *     city to feed it, so it can never be restocked.
 * Read-only, no side effect; nothing is persisted — freshly computed whenever asked. Resource-agnostic: every
 * good and role comes from the building's own catalog entry (`getCycleRecipeEntries`), never named here.
 */
import { isOperational } from '../../domain/policies/OperationalGatePolicy.js';
import { isWithinRange } from '../../domain/policies/ResourceRangePolicy.js';
import { getCycleRecipeEntries } from '../../../../shared/building-catalog/resourceRoleQueries.js';

export class DescribeActivitySupplyAccess {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {{ id: string, type: string, x?: number, y?: number }} building
   * @returns {Promise<Array<{ category: string, inputCategory: string, role: string, status: 'no-hub' | 'no-supplier' }>>}
   *   Only the problems — an empty list means every recipe can reach and be supplied.
   */
  async execute(building) {
    const gaps = [];
    for (const entry of getCycleRecipeEntries(building?.type)) {
      const inputs = entry.cycle.flatMap((step) => step.inputs ?? []).filter((input) => input.from);
      for (const input of inputs) {
        const status = await this.#gapFor(building, input);
        if (status) gaps.push({ category: entry.categories[0], inputCategory: input.category, role: input.from.role, status });
      }
    }
    return gaps;
  }

  async #gapFor(building, input) {
    const { role, range = Infinity } = input.from;
    const holders = await this.supplyBuildingRepository.findByResourceRole(role, input.category);
    const reachable = holders.some((holder) => this.#isUsableHolder(building, holder, range));
    if (!reachable) return 'no-hub';

    // 'producer' only — a hub's own 'collector' role (how it gathers from producers in range) matches the
    // same categories as its 'hub' role by construction, so checking it here would always be true and never
    // catch the case this is FOR: a warehouse reachable, but nothing anywhere actually makes the good.
    const suppliers = await this.supplyBuildingRepository.findByResourceRole('producer', input.category);
    const hasSupplier = suppliers.some((supplier) => this.#isOperationalBuilding(supplier));
    return hasSupplier ? null : 'no-supplier';
  }

  #isUsableHolder(building, holder, range) {
    return (
      holder.id !== building.id &&
      holder.x != null &&
      holder.y != null &&
      isWithinRange(building, holder, range) &&
      this.#isOperationalBuilding(holder)
    );
  }

  #isOperationalBuilding(candidate) {
    return isOperational({
      type: candidate.type,
      roadCount: candidate.roadCount,
      worker: candidate.worker,
      workerNeed: candidate.workerNeed,
    });
  }
}
