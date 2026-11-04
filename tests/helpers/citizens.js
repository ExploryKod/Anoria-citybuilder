/** The id of the `index`th fake citizen. */
export function citizenId(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

/** `count` citizens as the residents policy reads them (a stored uuid and first name), in the order of a house. */
export function fakeCitizens(count) {
  return Array.from({ length: count }, (_, index) => ({ id: citizenId(index), firstName: `Habitant ${index}`, health: 70 }));
}
