/**
 * Catalogue de missions. Une mission dit seulement ce que le jeu en fait : la taille de la carte et son nom. Ni date, ni climat, ni combat, ni
 * conditions de victoire : le jeu n'en a pas, et la page n'invente rien.
 */

/** @typedef {'story' | 'open'} MissionCategory */

/**
 * @typedef {object} StoryMission
 * @property {string} id
 * @property {'story'} category
 * @property {string} name
 * @property {string} title
 * @property {string} land
 * @property {number} citySize Side of the square map, in tiles (12 to 18: the playable range, see resolveCitySize.js). It follows `land`: a narrow land is 12, a medium one 16, a vast one 18.
 * @property {string} previewEmoji
 */

export const STORY_MISSIONS = [
  {
    id: 'anoria-prime',
    category: 'story',
    name: 'Anoria Prime',
    title: 'Une affaire citadine',
    land: 'Terre vaste',
    citySize: 18,
    previewEmoji: '🏛️',
  },
  {
    id: 'delta-trade',
    category: 'story',
    name: 'Delta des échanges',
    title: 'Routes du delta',
    land: 'Terre moyenne',
    citySize: 16,
    previewEmoji: '🏺',
  },
  {
    id: 'northern-front',
    category: 'story',
    name: 'Frontière du nord',
    title: 'Les convois du nord',
    land: 'Terre étroite',
    citySize: 12,
    previewEmoji: '🛡️',
  },
  {
    id: 'sacred-valley',
    category: 'story',
    name: 'Vallée sacrée',
    title: 'Offrandes du delta',
    land: 'Terre vaste',
    citySize: 18,
    previewEmoji: '🌾',
  },
];

/** Missions jouables avec une carte JSON — la liste des cartes est dans le panneau « Ma carte ». */
export const OPEN_MISSIONS = [
  {
    id: 'open-terrain',
    category: 'open',
    name: 'Open mission',
    title: 'Terrain personnalisé',
    land: 'Selon la carte',
    citySize: 12,
    previewEmoji: '🗺️',
  },
];

export const ALL_MISSIONS = Object.freeze([...STORY_MISSIONS, ...OPEN_MISSIONS]);

/** @deprecated use STORY_MISSIONS */
export const MISSIONS = STORY_MISSIONS;

/** @param {string} id */
export function getMissionById(id) {
  return ALL_MISSIONS.find((m) => m.id === id) ?? STORY_MISSIONS[0];
}

/** @param {object | null | undefined} mission */
export function isOpenMission(mission) {
  return mission?.category === 'open';
}
