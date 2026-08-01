/**
 * Legacy gameplay config sections — sourced from BC catalogs via ACL.
 * Used by config.js mirror only; new code should use domain-specific ACL getters.
 */
import {
  readInitialFundsFromImportMeta,
  COMMERCIAL_ROUTE_FEE,
} from '../../contexts/accounting/domain/catalogs/TreasuryCatalog.js';
import {
  EMPLOYMENT_MAX_SECTORS,
  EMPLOYMENT_SECTOR_NAMES,
  DEFAULT_SECTOR_PRIORITIES,
  BUILDING_SECTOR_MAP,
  BUILDING_EMPLOYEE_NEEDS,
} from '../../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import {
  FACTORY_MAX_STORAGE,
  FACTORY_EMPLOYEE_NEEDS,
} from '../../contexts/supply/domain/manufacturing/ProductRecipeCatalog.js';
import { DEFAULT_FOOD_DISTRIBUTION_DISTANCE } from '../../contexts/supply/domain/catalogs/SupplySimulationCatalog.js';
import {
  MIN_WORKING_AGE,
  RETIREMENT_AGE,
  DEFAULT_HOUSEHOLD_SIZE,
} from '../../contexts/housing/domain/catalogs/CitizenDemographicsCatalog.js';

/** @returns {import('../game/config.js').default['budget']} */
export function getLegacyBudgetConfigSection() {
  return {
    initialFunds: readInitialFundsFromImportMeta(),
    commercialRouteFee: COMMERCIAL_ROUTE_FEE,
  };
}

/** @returns {import('../game/config.js').default['employment']} */
export function getLegacyEmploymentConfigSection() {
  return {
    maxSectors: EMPLOYMENT_MAX_SECTORS,
    sectors: EMPLOYMENT_SECTOR_NAMES,
    defaultPriorities: DEFAULT_SECTOR_PRIORITIES,
    buildingSectorMap: BUILDING_SECTOR_MAP,
    buildingNeeds: BUILDING_EMPLOYEE_NEEDS,
    factoryEmployeeNeeds: FACTORY_EMPLOYEE_NEEDS,
    factoryMaxStorage: FACTORY_MAX_STORAGE,
  };
}

/** @returns {import('../game/config.js').default['citizens']} */
export function getLegacyCitizensConfigSection() {
  return {
    minWorkingAge: MIN_WORKING_AGE,
    retirementAge: RETIREMENT_AGE,
    defaultHouseholdSize: DEFAULT_HOUSEHOLD_SIZE,
  };
}

/** @param {number} [foodDistributionDistance] */
export function getLegacySimulationGameplaySection(foodDistributionDistance = DEFAULT_FOOD_DISTRIBUTION_DISTANCE) {
  return {
    foodDistributionDistance,
  };
}
