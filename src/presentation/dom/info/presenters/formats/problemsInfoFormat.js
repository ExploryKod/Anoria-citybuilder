/**
 * Problems tab of a workplace — pure format. What stands in the way of the building, grouped: its infrastructure (its road), its purchases (why it did not buy what waited at
 * its sellers, as it noted at its last purchase: see ProcessHubCollection and TransferHubToHub), and the public aid it asks for when a purchase failed for lack of money.
 * Strikes and the like will be one more group. Each line opens with its emoji.
 */

import { buildingName, goodAmount, goodLabel } from '../../../shell/CatalogVocabulary.js';
import { getCollectionRefusalReason, isMoneyRefusal } from '../../../../../shared/resource-catalog/CollectionRefusalCatalog.js';
import { isRoadNeedMet } from '../../../../../shared/building-catalog/resourceRoleQueries.js';

/** The sentence a purchase refusal makes, from the point of view of the building that bought (a hub's own reasons name it; a seller's do not). */
const sayRefusal = (vm, reasonId) => {
  const { side, sentence } = getCollectionRefusalReason(reasonId);
  return side === 'seller' ? sentence : `${buildingName(vm.buildingType)} : ${sentence}`;
};

/**
 * The refusals a hub or a market noted at its last purchase, as lines { emoji, text, reason }.
 * @param {object} row the building's record
 * @param {object} vm
 */
function purchaseLines(vm) {
  const row = vm.buildingRow;
  const lines = [];
  const hubSaid = row?.collectionRefusals;
  if (hubSaid?.hubReason) {
    const { emoji } = getCollectionRefusalReason(hubSaid.hubReason);
    lines.push({ emoji, text: sayRefusal(vm, hubSaid.hubReason), reason: hubSaid.hubReason });
  }
  for (const [category, { limits }] of Object.entries(hubSaid?.goods ?? {})) {
    for (const [reasonId, units] of Object.entries(limits)) {
      const { emoji } = getCollectionRefusalReason(reasonId);
      lines.push({ emoji, text: `${goodLabel(category)} — ${sayRefusal(vm, reasonId)} (${goodAmount(category, Math.round(units))} refusés)`, reason: reasonId });
    }
  }
  if (row?.transferRefusal) {
    const { emoji } = getCollectionRefusalReason(row.transferRefusal.reason);
    lines.push({ emoji, text: sayRefusal(vm, row.transferRefusal.reason), reason: row.transferRefusal.reason });
  }
  return lines;
}

/** The icon of the request for a public aid (the Problems tab and the Messages tab say it with the same one): the city, which is asked. */
export const PUBLIC_AID_REQUEST_EMOJI = '🏛️';

/**
 * Whether a purchase of this building failed for lack of money: the public aid is then asked for (the Problems tab and the Messages say so).
 * @param {{ collectionRefusals?: object, transferRefusal?: { reason: string } } | null | undefined} row
 * @returns {boolean}
 */
export function asksPublicAid(row) {
  const goods = Object.values(row?.collectionRefusals?.goods ?? {});
  const moneyInGoods = goods.some(({ limits }) => Object.keys(limits).some(isMoneyRefusal));
  return moneyInGoods || (row?.transferRefusal ? isMoneyRefusal(row.transferRefusal.reason) : false);
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ groups: Array<{ title: string, lines: Array<{ emoji: string, text: string, kind: 'problem' | 'request' }> }> }}
 *   A line is either the evocation of a problem (`problem`: a pale red pill) or what the building asks to solve it (`request`: a blue pill).
 */
export function formatProblemsModel(vm) {
  const groups = [];

  const infrastructure = [];
  if (vm.buildingRow && !isRoadNeedMet(vm.buildingRow.type, vm.buildingRow.roads)) {
    infrastructure.push({ emoji: '🛣️', text: `${buildingName(vm.buildingType)} n'a pas de route : il ne peut pas fonctionner`, kind: 'problem' });
  }
  if (infrastructure.length > 0) groups.push({ title: 'Infrastructure', lines: infrastructure });

  const purchases = purchaseLines(vm).map(({ emoji, text }) => ({ emoji, text, kind: 'problem' }));
  if (asksPublicAid(vm.buildingRow)) purchases.push({ emoji: PUBLIC_AID_REQUEST_EMOJI, text: 'Une aide publique est demandée', kind: 'request' });
  if (purchases.length > 0) groups.push({ title: 'Achats', lines: purchases });

  return { groups };
}
