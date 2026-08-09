/** @typedef {{ id: string, label: string, gateKey?: string }} MobileToolbarCategory */

/** @type {MobileToolbarCategory[]} */
export const MOBILE_TOOLBAR_CATEGORIES = [
  { id: 'houses', label: 'Habitations' },
  { id: 'palaces', label: 'Palais', gateKey: 'palace-btn' },
  { id: 'farms', label: 'Agriculture' },
  { id: 'industry', label: 'Industrie' },
  { id: 'infrastructure', label: 'Infra' },
  { id: 'roads', label: 'Routes' },
  { id: 'markets', label: 'Commerce' },
  { id: 'public', label: 'Services' },
  { id: 'nature', label: 'Nature' },
  { id: 'decoration', label: 'Décor' },
  { id: 'tombs', label: 'Cimetière' },
];
