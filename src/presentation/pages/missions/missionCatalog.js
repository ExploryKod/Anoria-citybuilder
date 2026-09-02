/** Catalogue de missions — données de démo (style Pharaon / César). */

/** @typedef {'story' | 'open'} MissionCategory */

/**
 * @typedef {object} StoryMission
 * @property {string} id
 * @property {'story'} category
 * @property {string} name
 * @property {string} title
 * @property {string} date
 * @property {string} climate
 * @property {string} land
 * @property {string} combat
 * @property {string} difficulty
 * @property {number} citySize
 * @property {{ label: string, value: string | number }[]} winConditions
 * @property {string[]} buildings
 * @property {string} previewEmoji
 */

export const STORY_MISSIONS = [
  {
    id: 'anoria-prime',
    category: 'story',
    name: 'Anoria Prime',
    title: 'Une affaire citadine',
    date: '400 av. J.-C.',
    climate: 'Climat normal',
    land: 'Terre vaste',
    combat: 'Escarmouches mineures',
    difficulty: 'Mission très difficile',
    citySize: 12,
    winConditions: [
      { label: 'Culture', value: 65 },
      { label: 'Prospérité', value: 75 },
      { label: 'Royaume', value: 75 },
      { label: 'Population', value: '20 000' },
      { label: 'Palais', value: 5 },
    ],
    buildings: ['Temple du soleil', 'Complexe pyramidal', 'Grande pyramide'],
    previewEmoji: '🏛️',
  },
  {
    id: 'delta-trade',
    category: 'story',
    name: 'Delta des échanges',
    title: 'Routes du delta',
    date: '350 av. J.-C.',
    climate: 'Climat chaud',
    land: 'Terre moyenne',
    combat: 'Pas de combat',
    difficulty: 'Mission normale',
    citySize: 12,
    winConditions: [
      { label: 'Commerce', value: 50 },
      { label: 'Prospérité', value: 60 },
      { label: 'Population', value: '8 000' },
    ],
    buildings: ['Marché', 'Entrepôt', 'Caravansérail'],
    previewEmoji: '🏺',
  },
  {
    id: 'northern-front',
    category: 'story',
    name: 'Frontière du nord',
    title: 'Les convois du nord',
    date: '280 av. J.-C.',
    climate: 'Climat froid',
    land: 'Terre étroite',
    combat: 'Combats fréquents',
    difficulty: 'Mission difficile',
    citySize: 12,
    winConditions: [
      { label: 'Défense', value: 70 },
      { label: 'Prospérité', value: 55 },
      { label: 'Population', value: '12 000' },
    ],
    buildings: ['Casernes', 'Muraille', 'Tour de guet'],
    previewEmoji: '🛡️',
  },
  {
    id: 'sacred-valley',
    category: 'story',
    name: 'Vallée sacrée',
    title: 'Offrandes du delta',
    date: '500 av. J.-C.',
    climate: 'Climat normal',
    land: 'Terre vaste',
    combat: 'Pas de combat',
    difficulty: 'Mission facile',
    citySize: 12,
    winConditions: [
      { label: 'Culture', value: 40 },
      { label: 'Ferveur', value: 50 },
      { label: 'Population', value: '5 000' },
    ],
    buildings: ['Sanctuaire', 'Autel', 'Jardin sacré'],
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
    date: 'Carte éditeur',
    climate: '—',
    land: 'Selon la carte',
    combat: '—',
    difficulty: 'Open mission',
    citySize: 12,
    winConditions: [
      { label: 'Objectif', value: 'Construire sur votre terrain' },
    ],
    buildings: [],
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
