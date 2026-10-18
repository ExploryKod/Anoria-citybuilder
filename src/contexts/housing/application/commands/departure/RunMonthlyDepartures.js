import { departureCauses } from '../../../../../shared/population/DepartureCauseCatalog.js';

/**
 * Command: once a month, judge every house against each cause of departure the catalog declares (see DepartureCauseCatalog.js) and let inhabitants
 * leave. The engine knows no cause by name: a cause is a signal (months of distress of a house), a threshold and a number of departures.
 *
 * What a house remembers, per cause, is its crisis: `house.departures[cause] = { left, of, months, settledMonth }`: `of` the inhabitants when the
 * distress began (it only grows while no one has left, so `left/of` never exceeds one), `left` how many left because of it since, `months` the months of
 * distress at the last judgement (the house's warning), `settledMonth` the month judged last (a month is judged once). The crisis is erased when the
 * distress is over; while it lasts the house does not grow back (see GrowHousePopulation.js). A house emptied keeps its crisis until the owner has
 * written off the debt the inhabitants left (WriteOffVacantRentDebts.js), which ends the distress the next month. A house that lost inhabitants to a cause
 * then serves its penalty: `house.repopulationBans[cause] = { until, remaining }` is the month until which it cannot grow back (the
 * catalog's `repopulationDelayMonths`) and the months left.
 */
export class RunMonthlyDepartures {
  /** @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository */
  constructor(housingBuildingRepository) {
    this.repository = housingBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {number} params.monthKey the month being judged, counted from the first year (a month is judged once)
   * @param {Record<string, Map<string, number>>} params.signals each signal's months of distress by house id; a house absent from it is fine
   * @returns {Promise<{ departed: number, houses: number }>}
   */
  async execute({ monthKey, signals }) {
    const houses = await this.repository.findResidentialHouses();
    let departed = 0;
    let housesAffected = 0;

    for (const house of houses) {
      const before = house.departures ?? {};
      const after = { ...before };
      const bansBefore = house.repopulationBans ?? {};
      // `remaining` is refreshed each month: it is what the house's message says (the engine alone knows the month).
      const bans = Object.fromEntries(
        Object.entries(bansBefore)
          .filter(([, ban]) => monthKey < ban.until)
          .map(([causeId, ban]) => [causeId, { until: ban.until, remaining: ban.until - monthKey }])
      );
      let pop = house.pop;
      let left = 0;

      for (const [causeId, cause] of departureCauses()) {
        const readings = signals[cause.signal];
        if (!(readings instanceof Map)) throw new Error(`[departure] cause "${causeId}" reads signal "${cause.signal}", which was not provided`);
        const months = readings.get(house.id) ?? 0;
        const crisis = before[causeId];

        if (months < cause.warnFromMonths) {
          // Over: a house that lost inhabitants to it is not repopulated at once (the penalty), a mere warning leaves nothing behind.
          if (crisis?.left > 0) {
            const until = Math.max(bans[causeId]?.until ?? 0, monthKey + cause.repopulationDelayMonths);
            bans[causeId] = { until, remaining: until - monthKey };
          }
          delete after[causeId];
          continue;
        }
        if (crisis?.settledMonth === monthKey) continue;

        const leaves = months >= cause.thresholdMonths ? Math.min(cause.leavePerMonth, pop) : 0;
        const leftBefore = crisis?.left ?? 0;
        after[causeId] = {
          // Until someone has left, the start follows the house's population (it may still have grown); after, it is fixed.
          of: leftBefore > 0 ? crisis.of : Math.max(crisis?.of ?? 0, pop),
          left: leftBefore + leaves,
          months,
          settledMonth: monthKey,
        };
        pop -= leaves;
        left += leaves;
      }

      if (JSON.stringify(after) === JSON.stringify(before) && JSON.stringify(bans) === JSON.stringify(bansBefore) && left === 0) continue;
      await this.repository.saveDepartures(house.id, { departures: after, repopulationBans: bans, pop });
      if (left > 0) {
        departed += left;
        housesAffected += 1;
      }
    }
    return { departed, houses: housesAffected };
  }
}
