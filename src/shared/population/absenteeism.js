/**
 * Absenteeism: a sick citizen does not work. The game does not say which citizen holds which post (a workplace stores only how many
 * workers come from each house, `workerSources`), so the absent of a workplace are the share of its workers that each source house's
 * sick make: `workers from the house × sick of the house / residents of the house`.
 *
 * One rule, read wherever the staff that actually works is needed: the operational gate and the capacity of a care service (whole
 * workers, `absentWorkersOf`) and the payroll and the sickness benefit (the share itself, in money, `absentBySource`).
 */

/**
 * The workers of a workplace that are absent, house by house: a share, not a head count, so the money that follows it is exact.
 * @param {Record<string, number>} workerSources `{ houseId: workers }` of the workplace
 * @param {(houseId: string) => { sick: number, residents: number }} healthOfHouse the sick and the residents of a source house
 * @returns {Record<string, number>} `{ houseId: absent workers }`, only for the houses that have some
 */
export function absentBySource(workerSources, healthOfHouse) {
  const absent = {};
  for (const [houseId, workers] of Object.entries(workerSources)) {
    if (!(workers > 0)) continue;
    const { sick, residents } = healthOfHouse(houseId);
    if (residents > 0 && sick > 0) absent[houseId] = (workers * Math.min(sick, residents)) / residents;
  }
  return absent;
}

/**
 * The same, in whole workers for the whole workplace: rounded, and never more than the workers assigned.
 * @param {Record<string, number>} workerSources
 * @param {(houseId: string) => { sick: number, residents: number }} healthOfHouse
 * @param {number} assigned the workers assigned to the workplace
 * @returns {number}
 */
export function absentWorkersOf(workerSources, healthOfHouse, assigned) {
  const total = Object.values(absentBySource(workerSources, healthOfHouse)).reduce((sum, share) => sum + share, 0);
  return Math.min(assigned, Math.round(total));
}
