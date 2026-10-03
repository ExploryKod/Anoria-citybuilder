/** @typedef {{ id: string, label: string, sourceBtnId: string, gateKey?: string }} MobileToolbarCategory */

/** @type {MobileToolbarCategory[]} */
export const MOBILE_TOOLBAR_CATEGORIES = [
  { id: 'houses', label: 'Habitations', sourceBtnId: 'residential-btn' },
  { id: 'farms', label: 'Agriculture', sourceBtnId: 'farm-btn' },
  { id: 'factories', label: 'Usines', sourceBtnId: 'industry-btn' },
  { id: 'warehouses', label: 'Entrepôts', sourceBtnId: 'market-btn' },
  { id: 'roads', label: 'Routes', sourceBtnId: 'roads-btn' },
  { id: 'public', label: 'Services publics', sourceBtnId: 'public-btn' },
];
