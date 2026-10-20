/**
 * Why people are out of work and why posts stay empty, in one hamlet (workers do not commute between hamlets): the same counts read two ways.
 *
 * The distribution of workers fills any vacancy that an idle citizen holds the skill for. So when citizens are out of work AND posts are vacant at the
 * same time, they do not match: the citizens lack the skill the posts ask for. What is left over on either side is a real shortage:
 * - out of work and reachable, with no vacancy to fill even if they had the skills: **no post** for them (a real lack of jobs);
 * - vacancies with no idle citizen at all to fill even if they had the skills: a **real lack of hands**.
 * Citizens living where no road reaches a workplace are out of work for that reason alone, and are told apart.
 *
 * @typedef {{ unemployedNoSkill: number, unemployedNoPosts: number, unemployedNoRoad: number, lackNoSkill: number, lackNoHands: number }} ShortfallCauses
 */

/**
 * @param {{ unemployed: number, unemployedNoRoad: number, lack: number }} counts unemployed: the citizens looking for a job who have none; unemployedNoRoad: those of
 *   them whose house no road connects; lack: the vacant posts of the workplaces
 * @returns {Readonly<ShortfallCauses>}
 */
export function employmentShortfallCauses({ unemployed, unemployedNoRoad, lack }) {
  const reachable = Math.max(0, unemployed - unemployedNoRoad);
  const mismatched = Math.min(reachable, lack);
  return Object.freeze({
    unemployedNoSkill: mismatched,
    unemployedNoPosts: reachable - mismatched,
    unemployedNoRoad,
    lackNoSkill: mismatched,
    lackNoHands: Math.max(0, lack - mismatched),
  });
}

/**
 * The causes of several hamlets, added up (each was worked out in its own hamlet).
 * @param {ReadonlyArray<Readonly<ShortfallCauses>>} perHamlet
 * @returns {Readonly<ShortfallCauses>}
 */
export function sumShortfallCauses(perHamlet) {
  const total = { unemployedNoSkill: 0, unemployedNoPosts: 0, unemployedNoRoad: 0, lackNoSkill: 0, lackNoHands: 0 };
  for (const causes of perHamlet) {
    for (const key of Object.keys(total)) total[key] += causes[key];
  }
  return Object.freeze(total);
}
