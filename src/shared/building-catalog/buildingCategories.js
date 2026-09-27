/**
 * Building type id sets used by scene tick filters, info panel, mesh loader.
 * Pure data — no DOM / Three. Prefer these over lists in ui/shell/nodes.
 *
 * `houses`/`commerce` moved to presentation/three/assets/buildingCategories.js
 * — they're pure derivations of BUILDING_ASSETS's button.group (a
 * presentation fact), and shared/ must not depend on presentation/.
 */

import { KENNEY_CITY_KIT_BUILDING_IDS } from './kenneyCityKitRegistry.generated.js';
import { buildingCatalog } from './buildingCatalog.js';
import { getAnnualSupplyEntry } from './resourceRoleQueries.js';

/** The farms: every type that feeds the chain once a year, as its catalog entry declares. */
export const farms = Object.freeze(Object.keys(buildingCatalog).filter((type) => getAnnualSupplyEntry(type)));

/**
 * Types that open the building info overlay when selected: every type that lives in the economy (it declares a
 * social group or roles in the supply chain) and the Kenney kit buildings.
 */
export const buildingsObjects = Object.freeze([
  ...new Set([
    ...Object.keys(buildingCatalog).filter(
      (type) => buildingCatalog[type].residentialGroup || (buildingCatalog[type].resourceRoles ?? []).length > 0
    ),
    ...KENNEY_CITY_KIT_BUILDING_IDS,
  ]),
]);
