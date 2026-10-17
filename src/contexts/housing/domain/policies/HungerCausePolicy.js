import { getQuantityConsumerEntry, getTotalKeyForCategory } from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * A house's risk of hunger, read each day: the units of its food need still missing today (what the day's last distribution pass left unmet), told
 * apart as in `splitUnfedByCause` — `unpaid` units are a disette to come, `shortage` units a pénurie to come. It is a forecast: the consequences
 * (deaths, growth, level) still come from the month's consumption record, never from this. Only the latest month's record counts.
 * @param {object} params
 * @param {number} params.pop
 * @param {string} params.houseType
 * @param {{ current?: { byNeed?: Record<string, { dayUnpaid?: number, dayShortage?: number }> } } | null | undefined} params.supplyShortfall
 * @returns {{ disette: number, penurie: number }} residents at risk (units over the catalog's per-capita need, never more than the inhabitants)
 */
export function hungerRiskOfHouse({ pop, houseType, supplyShortfall }) {
  const entry = getQuantityConsumerEntry(houseType);
  if (!entry) throw new Error(`[hunger] "${houseType}" declares no quantity consumer: its hunger has no food need to read`);
  const totalKey = entry.totalKey ?? getTotalKeyForCategory(entry.categories[0]);
  const figures = supplyShortfall?.current?.byNeed?.[totalKey];
  const residents = Math.max(0, Math.floor(pop) || 0);
  const perCapita = entry.amount > 0 ? entry.amount : 1;
  const atRisk = (units) => Math.min(residents, Math.ceil((units ?? 0) / perCapita));
  const disette = atRisk(figures?.dayUnpaid);
  const penurie = Math.min(residents - disette, atRisk(figures?.dayShortage));
  return { disette, penurie };
}

/**
 * Splits a house's unfed residents between the two ways to go hungry (see HungerCauseCatalog.js): `disette` (it could not pay the food on sale) and
 * `penurie` (there was nothing to buy). The supply cycle records, for the month of the last consumption, how many units of the house's food need
 * were unpaid and how many were short (`supplyShortfall`, see DistributeResourceToConsumers.js): the unfed are shared in the same proportion.
 * A house with no such record was never reached by a seller at all, which is a shortage by definition (nothing to buy).
 * @param {object} params
 * @param {number} params.unfed unfed residents of the house
 * @param {string} params.houseType
 * @param {{ month?: number } | null | undefined} params.lastConsumption
 * @param {{ current?: object, previous?: object } | null | undefined} params.supplyShortfall
 * @returns {{ disette: number, penurie: number }}
 */
export function splitUnfedByCause({ unfed, houseType, lastConsumption, supplyShortfall }) {
  if (!(unfed > 0)) return { disette: 0, penurie: 0 };
  const entry = getQuantityConsumerEntry(houseType);
  if (!entry) throw new Error(`[hunger] "${houseType}" declares no quantity consumer: its hunger has no food need to read`);
  const totalKey = entry.totalKey ?? getTotalKeyForCategory(entry.categories[0]);
  const month = lastConsumption?.month;
  const record = [supplyShortfall?.current, supplyShortfall?.previous].find((candidate) => candidate && candidate.monthIndex === month);
  const figures = record?.byNeed?.[totalKey];
  const unpaid = figures?.unpaid ?? 0;
  const shortage = figures?.shortage ?? 0;
  if (!(unpaid > 0)) return { disette: 0, penurie: unfed };
  const disette = Math.min(unfed, Math.round((unfed * unpaid) / (unpaid + shortage)));
  return { disette, penurie: unfed - disette };
}
