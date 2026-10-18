/**
 * A journal line as the journal writes it: with its journal code and the legs its type gets in the chart of accounts of its account. Policies read the legs
 * the journal booked, so a hand-made line is booked the same way before it is given to one. A line that is no écriture (an informative one) stays as it is.
 */
import { entryLegsOf, isEcriture } from '../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';

/** @param {object} line @returns {object} the same line with `journal` and `legs` */
export function booked(line) {
  if (!isEcriture(line.type)) return line;
  const { journal, legs } = entryLegsOf({ type: line.type, amount: line.amount, accountBuildingId: line.accountBuildingId ?? null, legs: line.legs ?? null });
  return { ...line, journal, legs };
}
