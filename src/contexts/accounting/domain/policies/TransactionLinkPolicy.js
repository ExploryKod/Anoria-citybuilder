/**
 * The écritures of one flow between accounts, set against one another.
 *
 * Each actor books its own écriture of a flow (a tax is a charge for the company and a product for the city): the écritures of one flow carry the same
 * `transactionId`, and each belongs to its own account. A flow seen from a single account has lost the other side: the consolidation of the accounts (the
 * city, its hamlets, its companies) would count it once as a charge and never as the product that answers it. This reads the journal for such flows.
 *
 * - `lonely`: a flow whose écritures are all on one account;
 * - `unlinked`: an écriture of a type that is one side of a flow (see `hasCounterpart`) that names no flow at all. A writer may leave it so when the other side is
 *   booked by another writer under its own flow, so this lists them rather than refusing them.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { isEcriture } from './EntryLegsPolicy.js';
import { hasCounterpart } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

/**
 * @param {Array<{ type: string, transactionId?: string | null, accountBuildingId?: string | null, accountKind?: string | null }>} entries the journal lines
 * @returns {{ lonely: Array<{ transactionId: string, types: string[] }>, unlinked: Array<object> }}
 */
export function unpairedFlowsOf(entries) {
  const flows = new Map();
  const unlinked = [];
  for (const entry of entries) {
    if (!isEcriture(entry.type) || !hasCounterpart(entry.type)) continue;
    if (!entry.transactionId) {
      unlinked.push(entry);
      continue;
    }
    const flow = flows.get(entry.transactionId) ?? { accounts: new Set(), types: [] };
    flow.accounts.add(accountKeyOf(entry) ?? 'city');
    flow.types.push(entry.type);
    flows.set(entry.transactionId, flow);
  }
  const lonely = [...flows]
    .filter(([, flow]) => flow.accounts.size < 2)
    .map(([transactionId, flow]) => ({ transactionId, types: flow.types }));
  return { lonely, unlinked };
}
