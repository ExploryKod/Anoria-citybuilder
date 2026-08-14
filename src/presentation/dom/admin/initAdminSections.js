/**
 * Panneau administrateur — boot de toutes les sections (après sessionApi).
 */

import { initAdministratorPanel } from './AdministratorPanel.js';
import { initFinancesSection } from './finances/initFinancesSection.js';
import { initHealthSection } from './health/initHealthSection.js';
import { initWorkSection } from './work/initWorkSection.js';
import { initStorageSection } from './storage/initStorageSection.js';
import { initFactorySection } from './factory/initFactorySection.js';
import { initCommerceSection } from './commerce/initCommerceSection.js';
import { initReportSection } from './report/initReportSection.js';
import { initArchivesSection } from './archives/initArchivesSection.js';

/**
 * @param {object} deps
 * @param {object} deps.accounting
 * @param {object} deps.commerce
 * @param {object} deps.employment
 * @param {object} deps.housing
 * @param {object} deps.supply
 * @param {object} deps.construction
 * @param {object} [deps.intelligence]
 * @param {object} [deps.popupManager]
 * @param {(name: string, instance: *) => void} [deps.registerAppService]
 * @param {(name: string, fn: Function) => void} [deps.registerAppFunction]
 * @param {(funds: number) => void} [deps.updateDisplayedFunds]
 * @param {() => number} [deps.getGameTime]
 */
export async function initAdminSections(deps) {
  initAdministratorPanel(deps);
  initFinancesSection(deps);
  initHealthSection(deps);
  initWorkSection(deps);
  initStorageSection(deps);
  initFactorySection(deps);
  await initCommerceSection(deps);
  initReportSection(deps);
  initArchivesSection(deps);
}
