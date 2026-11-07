/**
 * Who works where, once the distribution has said how many of each house work at each workplace (WorkerAllocationPolicy.js): the persons are named here.
 *
 * Within a house the residents are taken fit first, then the sick (a sick resident is hired only when there are not enough fit ones), each rank by the lower of their two
 * scores, the best first, then in the house's stable order. An invalid resident is not hired at all: he holds no post (the social security pays him a pension). The workplaces
 * take their share in the order they are given; whoever is left has no job.
 */

const RANK = Object.freeze({ fit: 0, sick: 1 });

/**
 * The residents of a house in the order they are hired, the invalid left out.
 * @param {ReadonlyArray<{ id: string, health: number, mentalHealth: number }>} citizens the house's citizens, in their stable order
 * @param {(citizen: object) => 'fit' | 'sick' | 'invalid'} statusOf
 * @returns {Array<{ id: string }>}
 */
export function hiringOrderOf(citizens, statusOf) {
  return citizens
    .map((citizen, position) => ({ citizen, position, status: statusOf(citizen) }))
    .filter(({ status }) => status !== 'invalid')
    .map((entry) => {
      if (!(entry.status in RANK)) throw new Error(`[employment] citizen ${entry.citizen.id} is neither fit nor sick nor invalid ("${entry.status}")`);
      return entry;
    })
    .sort((a, b) => RANK[a.status] - RANK[b.status]
      || Math.min(b.citizen.health, b.citizen.mentalHealth) - Math.min(a.citizen.health, a.citizen.mentalHealth)
      || a.position - b.position)
    .map(({ citizen }) => citizen);
}

/**
 * The workplace of every citizen of a house.
 * @param {ReadonlyArray<{ id: string, health: number, mentalHealth: number }>} citizens the house's citizens, in their stable order
 * @param {(citizen: object) => 'fit' | 'sick' | 'invalid'} statusOf
 * @param {ReadonlyArray<{ workplaceId: string, workers: number }>} shares how many of this house's residents each workplace takes, in the order they are served
 * @returns {Map<string, string | null>} citizen id → workplace id, or null when he has no job
 */
export function workplacesOfHouse(citizens, statusOf, shares) {
  const hired = hiringOrderOf(citizens, statusOf);
  const wanted = shares.reduce((sum, share) => sum + share.workers, 0);
  if (wanted > hired.length) {
    throw new Error(`[employment] ${wanted} residents are to be hired from a house that has only ${hired.length} who can work (${citizens.length} residents): the pool was counted otherwise`);
  }
  const assignment = new Map(citizens.map((citizen) => [citizen.id, null]));
  let next = 0;
  for (const { workplaceId, workers } of shares) {
    for (let i = 0; i < workers; i += 1) assignment.set(hired[next++].id, workplaceId);
  }
  return assignment;
}
