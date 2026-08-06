/**
 * Presentation-facing exports for house dwelling level labels.
 * Keeps `presentation/` off direct `domain/` imports (architecture boundary).
 */

export {
  getHouseDwellingLevelAriaLabel,
  getHouseDwellingLevelLabel,
  resolveHouseDwellingStatusMessage,
} from '../../domain/value-objects/HouseDwellingLevel.js';

export { maxPopulationForLevel } from '../../domain/policies/HouseCapacityPolicy.js';
