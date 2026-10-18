/**
 * Static employment catalog for presentation (no getOrCreate). Live
 * employment operations stay on employmentOps.js, composition-internal only.
 */
export { allSocialGroups } from '../contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';
export {
  getRequiredSkillForBuilding,
  getRequiredSkillLevelForBuilding,
} from '../contexts/employment/domain/policies/WorkplaceSkillRequirementPolicy.js';
