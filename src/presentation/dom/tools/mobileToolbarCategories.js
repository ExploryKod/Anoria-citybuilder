import { getResidentialGroupLabel } from '../shell/ResidentialGroupLabels.js';

/** @typedef {{ id: string, label: string, sourceBtnId: string | null, iconHtml?: string, gateKey?: string }} MobileToolbarCategory */

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
  // Land the town hall puts up for sale, one sub-tab per use (land-catalog/LandUseCatalog.js): the pill wears its own icon, it has no button in the stubs
  {
    id: 'plots',
    label: 'Terrains',
    sourceBtnId: null,
    iconHtml: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20V9"/><path d="M9 20V9"/><path d="M13 20V9"/><path d="M17 20V9"/><path d="M3 12h18"/></svg>',
  },
  // Roads are not a pill: the road tool has its own button next to the one that opens this bar (CompactToolbar.js, mountRoadButton).
];
