/**
 * Why a hub (a warehouse, a granary, a market) did not buy what waited at the seller, as it is said to the player. The supply writes the reason of each refusal as it buys
 * (see CollectResourceToHub.js) and the screens read the sentence and the emoji that opens its line here.
 *
 * `hub`: the reason is the hub's, buying from the producers (its place, its orders, its purse, its state); `buyer`: the market's, buying from its hub; `seller`: it is the
 * seller's (its road, its distance from the buyer, its sale window, its stock). `no_budget` is the purse of whoever was buying, and the one reason that is a money problem
 * (`isMoneyRefusal`): the player is then told that a public aid is asked for.
 */
const reason = (side, emoji, sentence) => Object.freeze({ side, emoji, sentence });

export const COLLECTION_REFUSAL_REASONS = Object.freeze({
  hub_full: reason('hub', '📦', 'plus de place dans son stock'),
  storage_order: reason('hub', '🚫', 'sa limite de stockage pour ce produit est atteinte, ou il a ordre de ne pas en prendre'),
  no_budget: reason('hub', '💰', 'pas assez de trésorerie pour payer'),
  hub_not_operational: reason('hub', '⛔', 'il ne fonctionne pas (pas de route ou pas assez de personnel)'),
  not_collection_period: reason('hub', '📅', "il n'achète pas encore : sa période d'achat n'est pas ouverte"),
  source_no_road: reason('seller', '🛣️', "le producteur n'a pas de route"),
  source_out_of_range: reason('seller', '📏', 'le producteur est trop loin'),
  source_sale_window: reason('seller', '📅', 'le producteur ne vend pas ce mois-ci : sa période de vente est fermée'),
  // What a market says of why it did not buy from the hub that feeds it (see TransferHubToHub.js): `buyer` is the market, `seller` the hub
  target_full: reason('buyer', '📦', 'plus de place dans son stock'),
  target_not_operational: reason('buyer', '⛔', 'il ne fonctionne pas (pas de route ou pas assez de personnel)'),
  no_source_link: reason('buyer', '🔗', "aucun entrepôt ou grenier ne lui est relié"),
  target_not_linked: reason('buyer', '🔗', "l'entrepôt ou le grenier qui le fournit ne l'a pas dans ses clients"),
  source_not_found: reason('buyer', '❓', "l'entrepôt ou le grenier qui devait le fournir n'existe plus"),
  source_not_operational: reason('seller', '⛔', "l'entrepôt ou le grenier qui le fournit ne fonctionne pas (pas de route ou pas assez de personnel)"),
  source_empty: reason('seller', '🫙', "l'entrepôt ou le grenier qui le fournit n'a rien à lui vendre"),
  nothing_to_transfer: reason('seller', '⏳', "l'entrepôt ou le grenier l'a laissé à d'autres clients, qui passent avant"),
});

/** @param {string} reasonId @returns {{ side: 'hub' | 'buyer' | 'seller', emoji: string, sentence: string }} */
export function getCollectionRefusalReason(reasonId) {
  const entry = COLLECTION_REFUSAL_REASONS[reasonId];
  if (!entry) throw new Error(`[CollectionRefusalCatalog] no sentence for the refusal "${reasonId}"`);
  return entry;
}

/** @param {string} reasonId @returns {boolean} whether the refusal is for lack of money (the buyer's purse is empty) */
export function isMoneyRefusal(reasonId) {
  getCollectionRefusalReason(reasonId);
  return reasonId === 'no_budget';
}
