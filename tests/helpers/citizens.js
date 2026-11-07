/** The id of the `index`th fake citizen. */
export function citizenId(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

/**
 * `count` citizens as the residents policy reads them (a stored uuid, first name and workplace), in the order of a house.
 * @param {number} count
 * @param {Array<{ workplaceId: string, workers: number }>} [workplaces] how many of the first citizens work where, in order; the others have no job
 */
export function fakeCitizens(count, workplaces = []) {
  const posts = workplaces.flatMap(({ workplaceId, workers }) => Array.from({ length: workers }, () => workplaceId));
  return Array.from({ length: count }, (_, index) => ({ id: citizenId(index), firstName: `Habitant ${index}`, health: 70, mentalHealth: 70, workplaceId: posts[index] ?? null }));
}
