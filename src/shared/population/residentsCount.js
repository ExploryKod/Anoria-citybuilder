/**
 * The residents count a stored building row carries (`pop`): a whole number, 0 for a building nobody lives in. A row without one is
 * a defect of its writer, so it throws, naming the row, instead of reading as an empty house.
 * @param {{ pop?: unknown, instanceId?: string, id?: string }} row
 * @returns {number}
 */
export function residentsCountOf(row) {
  if (!Number.isInteger(row.pop) || row.pop < 0) {
    throw new Error(`[population] building ${row.instanceId ?? row.id ?? '?'} has no residents count (pop), got ${row.pop}`);
  }
  return row.pop;
}
