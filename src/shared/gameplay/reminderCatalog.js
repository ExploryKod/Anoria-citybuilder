import { getBuildingDefinition } from '../building-catalog/buildingCatalog.js';
import { getSkillDisplay } from '../population/skillCatalog.js';
import { OWNER_SKILL, TAX_COLLECTION_SKILLS } from '../population/socialCategoryCatalog.js';

/**
 * The short reminders the bar of the game shows while their cause lasts (see HudTicker.js): each rule reads the facts of the city
 * (`ReminderFacts`, gathered by composition/reminderFacts.js) and says its words. A reminder shows while its `when` is true and goes by itself when
 * the player has settled the cause, so a new reminder is one more entry here. Names and skills come from the catalogs; the sentences are narrative.
 *
 * A reminder says what is wrong, never what is going well: while the player does what the game guided them to do (picking the mayor's house to place
 * it, or having placed it), nothing is said.
 *
 * @typedef {{
 *   openingOver: boolean,
 *   ownerHousePlaced: boolean,
 *   placingOwnerHouse: boolean,
 *   ownerHouseHasResidents: boolean,
 *   otherHousesPlaced: boolean,
 *   rentDebtors: number,
 *   rentDebtTotal: number,
 * }} ReminderFacts `openingOver`: the game's opening (the dépêches that guide the player) is over; `placingOwnerHouse`: the owner's house is the tool in hand
 * @typedef {{ euro: (amount: number) => string }} ReminderWords the money's words, given by the screen
 */

const mayorHouse = () => getBuildingDefinition('House-Mayor').displayName;

/** @type {ReadonlyArray<{ id: string, when: (facts: ReminderFacts) => boolean, text: (facts: ReminderFacts, words: ReminderWords) => string }>} */
export const REMINDERS = Object.freeze([
  {
    id: 'place-mayor-house',
    // Only when the player has let the guidance go: the opening is over, the house is not placed, and it is not in hand to be placed.
    when: (facts) => facts.openingOver && !facts.ownerHousePlaced && !facts.placingOwnerHouse,
    text: () => `Placez la maison du maire (${mayorHouse()}) : sans elle, aucune autre maison ne peut être construite.`,
  },
  {
    id: 'house-the-mayor',
    // Right after it is placed the house is empty, which is normal: it is a problem once other houses stand and it still has no residents.
    when: (facts) => facts.ownerHousePlaced && facts.otherHousesPlaced && !facts.ownerHouseHasResidents,
    text: () => `La maison du maire attend ses habitants : sans ${getSkillDisplay(OWNER_SKILL).label.toLowerCase()} ni ${getSkillDisplay(TAX_COLLECTION_SKILLS.citizen).label.toLowerCase()}, ni loyers ni impôts.`,
  },
  {
    id: 'rent-debt',
    when: (facts) => facts.rentDebtors > 0,
    text: (facts, words) => `${facts.rentDebtors} ${facts.rentDebtors > 1 ? 'maisons doivent' : 'maison doit'} un loyer au maire (${words.euro(facts.rentDebtTotal)} en tout).`,
  },
]);

/**
 * @param {ReminderFacts} facts
 * @param {ReminderWords} words
 * @returns {string[]} the reminders that hold now, in the catalog's order
 */
export function remindersFor(facts, words) {
  return REMINDERS.filter((reminder) => reminder.when(facts)).map((reminder) => reminder.text(facts, words));
}
