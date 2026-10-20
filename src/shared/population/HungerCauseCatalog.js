/**
 * The two ways to go hungry, told apart everywhere the player reads about hunger (the house's panel and messages, the population rail):
 * - `disette`: the house could not pay for the food that was on sale (its money ran out);
 * - `penurie`: there was nothing to buy (empty shelves, no farm or market in reach).
 * Data only: the words and icons live here, so changing them changes them everywhere. How a house's hunger is split between the two is
 * HungerCausePolicy.js. `detail` finishes the sentence "<n> d'entre nous ..." in a tooltip.
 */
/**
 * The early warning of hunger (the population rail's indicator), which is not hunger yet: the inhabitants whose house is still missing, today,
 * part of the ration it needs for the month (see HungerCausePolicy.js `hungerRiskOfHouse`). `detail` finishes "<n> d'entre nous ..." in its tooltip.
 */
export const HUNGER_RISK = Object.freeze({
  icon: '⚠️',
  label: 'Risque de faim',
  detail: "n'ont pas encore de quoi tenir le mois",
});

export const HUNGER_CAUSES = Object.freeze({
  disette: Object.freeze({
    icon: '💸',
    label: 'Disette',
    detail: 'ne peuvent pas payer la nourriture',
  }),
  penurie: Object.freeze({
    icon: '🏜️',
    label: 'Pénurie',
    detail: "n'ont rien à manger : aucune nourriture à acheter",
  }),
});
