/** Catalogue de missions — données de démo (style Pharaon / César). */

export const MISSIONS = [
  {
    id: 'anoria-prime',
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

/** @param {string} id */
export function getMissionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}
