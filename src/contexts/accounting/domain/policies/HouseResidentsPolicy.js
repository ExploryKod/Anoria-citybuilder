/**
 * The citizens of one household, one record each: who works where, who is paid by the hamlet, who is out of work. Each record is a real
 * citizen of the registry (its uuid, first name and workplace are stored); the status is read from it: a citizen with a `workplaceId` is a worker
 * there, one without is unemployed, except in a household whose category looks for no job, where every resident is an administrator (the hamlet
 * pays them a stipend, they are never unemployed). Civil servants were removed from this split (2026-10-10, "suppress it for now"). The
 * citizens come in their stable order, so a card keeps its place from one month to the next.
 *
 * @param {{ houseId: string, citizens: ReadonlyArray<{ id: string, firstName: string, health: number, mentalHealth: number, workplaceId: string | null }>, seeksWork: boolean }} params
 *   seeksWork: whether the residents of this household's category look for a job (the administrators' do not)
 * @returns {Array<{ id: string, houseId: string, firstName: string, status: 'worker' | 'administrator' | 'unemployed', workplaceId: string | null }>}
 */
export function residentsOfHouse({ houseId, citizens, seeksWork }) {
  if (!houseId) throw new Error('[residents] a household needs its id');
  if (typeof seeksWork !== 'boolean') throw new Error(`[residents] household ${houseId} needs to know whether its residents look for a job, got ${seeksWork}`);
  return citizens.map((citizen) => {
    if (!seeksWork && citizen.workplaceId !== null) {
      throw new Error(`[residents] citizen ${citizen.id} of household ${houseId} works at ${citizen.workplaceId}, but the residents of this household look for no job`);
    }
    return {
      id: citizen.id,
      houseId,
      firstName: citizen.firstName,
      health: citizen.health,
      mentalHealth: citizen.mentalHealth,
      status: !seeksWork ? 'administrator' : citizen.workplaceId === null ? 'unemployed' : 'worker',
      workplaceId: citizen.workplaceId,
    };
  });
}
