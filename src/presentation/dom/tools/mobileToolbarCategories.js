import { getResidentialGroupLabel } from '../shell/ResidentialGroupLabels.js';

/** @typedef {{ id: string, label: string, sourceBtnId: string, gateKey?: string }} MobileToolbarCategory */

/**
 * A pill of one social class: it is named after the class's house (the catalog's name for it), and lists the buildings
 * its houses staff (see `toolbarGroupOf` in buildingCategories.js).
 */
const socialClassCategory = (id, sourceBtnId) => ({
  id,
  get label() {
    return getResidentialGroupLabel(id);
  },
  sourceBtnId,
});

/** @type {MobileToolbarCategory[]} */
export const MOBILE_TOOLBAR_CATEGORIES = [
  { id: 'houses', label: 'Habitations', sourceBtnId: 'residential-btn' },
  socialClassCategory('artisans', 'artisans-btn'),
  socialClassCategory('merchants', 'merchants-btn'),
  socialClassCategory('scholars', 'scholars-btn'),
  { id: 'roads', label: 'Routes', sourceBtnId: 'roads-btn' },
];
