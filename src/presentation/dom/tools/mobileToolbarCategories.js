/** @typedef {{ id: string, label: string, sourceBtnId: string, gateKey?: string }} MobileToolbarCategory */

/** @type {MobileToolbarCategory[]} */
export const MOBILE_TOOLBAR_CATEGORIES = [
  { id: 'houses', label: 'Habitations', sourceBtnId: 'residential-btn' },
  { id: 'farms', label: 'Agriculture', sourceBtnId: 'farm-btn' },
  { id: 'industry', label: 'Industrie', sourceBtnId: 'industry-btn' },
  { id: 'roads', label: 'Routes', sourceBtnId: 'roads-btn' },
  { id: 'markets', label: 'Commerce', sourceBtnId: 'market-btn' },
];
