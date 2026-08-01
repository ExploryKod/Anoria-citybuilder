/**
 * After placement/demolition: redistribute if workplace changed, then refresh UI.
 */

import {
  isEmploymentWorkplaceType,
  redistributeCityEmployment,
} from './facades/employment.js';

/**
 * @param {{ refreshEmploymentPresentation: (city: object) => Promise<void> }} scene
 * @param {object} city
 * @param {string | null | undefined} buildingType
 */
export async function syncEmploymentAfterBuildingChange(scene, city, buildingType) {
  if (isEmploymentWorkplaceType(buildingType)) {
    await redistributeCityEmployment();
  }
  await scene.refreshEmploymentPresentation(city);
}
