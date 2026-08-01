/**
 * Legacy gameplay config sections — sourced from BC catalogs via ACL.
 * New code should use domain-specific ACL getters or shared defaults.
 */
import {
  readInitialFundsFromImportMeta,
  COMMERCIAL_ROUTE_FEE,
} from '../contexts/accounting/domain/catalogs/TreasuryCatalog.js';
import {
  EMPLOYMENT_MAX_SECTORS,
  EMPLOYMENT_SECTOR_NAMES,
  DEFAULT_SECTOR_PRIORITIES,
  BUILDING_SECTOR_MAP,
  BUILDING_EMPLOYEE_NEEDS,
} from '../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import {
  FACTORY_MAX_STORAGE,
  FACTORY_EMPLOYEE_NEEDS,
} from '../contexts/supply/domain/manufacturing/ProductRecipeCatalog.js';
import { DEFAULT_FOOD_DISTRIBUTION_DISTANCE } from '../contexts/supply/domain/catalogs/SupplySimulationCatalog.js';
import {
  MIN_WORKING_AGE,
  RETIREMENT_AGE,
  DEFAULT_HOUSEHOLD_SIZE,
} from '../contexts/housing/domain/catalogs/CitizenDemographicsCatalog.js';
import { getSimulationDefaults } from '../shared/gameplay/SimulationDefaults.js';
import { BUILDING_PLACEMENT_DEFAULTS } from '../shared/gameplay/BuildingPlacementDefaults.js';
import { UI_DEFAULTS } from '../shared/ui/UiDefaults.js';

export function getLegacyBudgetConfigSection() {
  return {
    initialFunds: readInitialFundsFromImportMeta(),
    commercialRouteFee: COMMERCIAL_ROUTE_FEE,
  };
}

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

/** Composed mirror for legacy tests documenting BC-backed config sections. */
export function composeLegacyConfigMirror() {
  return {
    simulation: getSimulationDefaults(),
    budget: getLegacyBudgetConfigSection(),
    building: BUILDING_PLACEMENT_DEFAULTS,
    citizens: getLegacyCitizensConfigSection(),
    objectives: { initialCheckOnPlay: true },
    employment: getLegacyEmploymentConfigSection(),
    ui: UI_DEFAULTS,
  };
}
