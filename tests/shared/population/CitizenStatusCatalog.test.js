import { describe, expect, test } from '@jest/globals';
import {
  CITIZEN_STATUS_PROFILES,
  resolveCitizenStatusFromLevel,
  getCitizenStatusProfile,
  hasSkill,
  getSkills,
  getDuties,
  getRights,
  getSkillNames,
} from '../../../src/shared/population/CitizenStatusCatalog.js';

describe('Shared Kernel: CitizenStatusCatalog', () => {
  const requiredStatuses = [
    'hunter-gatherer',
    'worker',
    'unemployed',
    'civil-servant',
    'elite',
    'youth',
    'retired',
  ];

  test('all required statuses are defined', () => {
    for (const status of requiredStatuses) {
      expect(CITIZEN_STATUS_PROFILES[status]).toBeDefined();
    }
  });

  test('all profiles have complete projections (housing, employment, accounting)', () => {
    for (const [key, profile] of Object.entries(CITIZEN_STATUS_PROFILES)) {
      expect(profile.housing).toBeDefined();
      expect(profile.employment).toBeDefined();
      expect(profile.accounting).toBeDefined();

      expect(typeof profile.housing.contributesToGrowth).toBe('boolean');
      expect(typeof profile.housing.consumesFood).toBe('boolean');

      expect(typeof profile.employment.isEmployable).toBe('boolean');
      expect(['by-group', 'none', 'object']).toContain(
        typeof profile.employment.eligibleSectors === 'object'
          ? 'object'
          : profile.employment.eligibleSectors
      );
      expect(typeof profile.employment.countsInLaborPool).toBe('boolean');

      expect(typeof profile.accounting.paysCitizenTax).toBe('boolean');
      expect(typeof profile.accounting.paysPayrollTax).toBe('boolean');
      expect(typeof profile.accounting.receivesIncome).toBe('boolean');
      expect(['none', 'self-sufficient', 'employer-paid', 'city-paid']).toContain(
        profile.accounting.incomeSource
      );
      expect(typeof profile.accounting.incomeMultiplier).toBe('number');
    }
  });

  test('profiles are frozen (immutable)', () => {
    for (const [key, profile] of Object.entries(CITIZEN_STATUS_PROFILES)) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.housing)).toBe(true);
      expect(Object.isFrozen(profile.employment)).toBe(true);
      expect(Object.isFrozen(profile.accounting)).toBe(true);
    }
  });

  describe('resolveCitizenStatusFromLevel', () => {
    test('level 1 → hunter-gatherer', () => {
      expect(resolveCitizenStatusFromLevel(1)).toBe('hunter-gatherer');
    });

    test('level 2 → worker', () => {
      expect(resolveCitizenStatusFromLevel(2)).toBe('worker');
    });
  });

  describe('getCitizenStatusProfile', () => {
    test('returns correct profile for known status', () => {
      const profile = getCitizenStatusProfile('worker');
      expect(profile.employment.isEmployable).toBe(true);
      expect(profile.accounting.paysCitizenTax).toBe(true);
    });

    test('defaults to hunter-gatherer for unknown status', () => {
      const profile = getCitizenStatusProfile('unknown-status');
      expect(profile).toBe(CITIZEN_STATUS_PROFILES['hunter-gatherer']);
    });
  });

  describe('Skills/Duties/Rights accessors', () => {
    test('hasSkill checks if a status has a specific skill', () => {
      expect(hasSkill('hunter-gatherer', 'subsistence-forager')).toBe(true);
      expect(hasSkill('hunter-gatherer', 'employment-eligible')).toBe(false);
      expect(hasSkill('worker', 'subsistence-forager')).toBe(true);
      expect(hasSkill('worker', 'employment-eligible')).toBe(true);
    });

    test('getSkills returns all skills for a status', () => {
      const hunterSkills = getSkills('hunter-gatherer');
      expect(Object.keys(hunterSkills)).toEqual(['subsistence-forager']);

      const workerSkills = getSkills('worker');
      expect(Object.keys(workerSkills)).toEqual(['subsistence-forager', 'employment-eligible']);
    });

    test('getDuties returns duties for a status', () => {
      const hunterDuties = getDuties('hunter-gatherer');
      expect(hunterDuties.taxpayer).toBe(false);

      const workerDuties = getDuties('worker');
      expect(workerDuties.taxpayer).toBe(true);
      expect(workerDuties.payrollTax).toBe(true);
    });

    test('getRights returns rights for a status', () => {
      const hunterRights = getRights('hunter-gatherer');
      expect(hunterRights.income.receives).toBe(false);

      const workerRights = getRights('worker');
      expect(workerRights.income.receives).toBe(true);
      expect(workerRights.income.source).toBe('employer-paid');
    });

    test('getSkillNames returns skill names array', () => {
      expect(getSkillNames('hunter-gatherer')).toEqual(['subsistence-forager']);
      expect(getSkillNames('worker')).toEqual(['subsistence-forager', 'employment-eligible']);
      expect(getSkillNames('elite')).toEqual(['governance']);
    });
  });

  describe('Status semantics (business rules)', () => {
    test('hunter-gatherers are outside the economy', () => {
      const profile = CITIZEN_STATUS_PROFILES['hunter-gatherer'];
      expect(profile.employment.isEmployable).toBe(false);
      expect(profile.accounting.paysCitizenTax).toBe(false);
      expect(profile.accounting.receivesIncome).toBe(false);
    });

    test('workers are in the labor pool and pay taxes', () => {
      const profile = CITIZEN_STATUS_PROFILES.worker;
      expect(profile.employment.countsInLaborPool).toBe(true);
      expect(profile.accounting.paysCitizenTax).toBe(true);
      expect(profile.accounting.incomeSource).toBe('employer-paid');
    });

    test('unemployed receive city-paid income at reduced rate', () => {
      const profile = CITIZEN_STATUS_PROFILES.unemployed;
      expect(profile.accounting.incomeSource).toBe('city-paid');
      expect(profile.accounting.incomeMultiplier).toBeLessThan(1.0);
      expect(profile.accounting.incomeMultiplier).toBeGreaterThan(0.0);
    });

    test('civil servants are city-paid and not in labor pool', () => {
      const profile = CITIZEN_STATUS_PROFILES['civil-servant'];
      expect(profile.employment.countsInLaborPool).toBe(false);
      expect(profile.accounting.incomeSource).toBe('city-paid');
      expect(profile.accounting.incomeMultiplier).toBe(1.0);
    });

    test('elites have income bonus and are outside labor pool', () => {
      const profile = CITIZEN_STATUS_PROFILES.elite;
      expect(profile.employment.countsInLaborPool).toBe(false);
      expect(profile.accounting.incomeMultiplier).toBeGreaterThan(1.0);
    });

    test('youth and retired are not economically active', () => {
      const youth = CITIZEN_STATUS_PROFILES.youth;
      const retired = CITIZEN_STATUS_PROFILES.retired;

      for (const profile of [youth, retired]) {
        expect(profile.employment.isEmployable).toBe(false);
        expect(profile.accounting.paysCitizenTax).toBe(false);
        expect(profile.accounting.receivesIncome).toBe(false);
      }
    });
  });

  describe('New structure: Skills + Duties + Rights', () => {
    test('all statuses have skills, duties, and rights', () => {
      for (const [key, profile] of Object.entries(CITIZEN_STATUS_PROFILES)) {
        expect(profile.skills).toBeDefined();
        expect(profile.duties).toBeDefined();
        expect(profile.rights).toBeDefined();
        expect(typeof profile.skills).toBe('object');
        expect(typeof profile.duties).toBe('object');
        expect(typeof profile.rights).toBe('object');
      }
    });

    test('hunter-gatherer has subsistence-forager skill', () => {
      const profile = CITIZEN_STATUS_PROFILES['hunter-gatherer'];
      expect(profile.skills['subsistence-forager']).toBeDefined();
      expect(profile.skills['subsistence-forager'].produces).toEqual({ fruit: 1, game: 1 });
    });

    test('worker has CUMULATIVE skills (subsistence + employment)', () => {
      const profile = CITIZEN_STATUS_PROFILES.worker;
      expect(profile.skills['subsistence-forager']).toBeDefined();
      expect(profile.skills['employment-eligible']).toBeDefined();
      expect(Object.keys(profile.skills).length).toBe(2);
    });

    test('duties reflect fiscal obligations', () => {
      expect(CITIZEN_STATUS_PROFILES['hunter-gatherer'].duties.taxpayer).toBe(false);
      expect(CITIZEN_STATUS_PROFILES.worker.duties.taxpayer).toBe(true);
      expect(CITIZEN_STATUS_PROFILES.worker.duties.payrollTax).toBe(true);
    });

    test('rights reflect income entitlements', () => {
      expect(CITIZEN_STATUS_PROFILES['hunter-gatherer'].rights.income.receives).toBe(false);
      expect(CITIZEN_STATUS_PROFILES.worker.rights.income.receives).toBe(true);
      expect(CITIZEN_STATUS_PROFILES.worker.rights.income.source).toBe('employer-paid');
      expect(CITIZEN_STATUS_PROFILES.unemployed.rights.income.source).toBe('city-paid');
    });

    test('elite has NO subsistence skill (palace luxury)', () => {
      const profile = CITIZEN_STATUS_PROFILES.elite;
      expect(profile.skills['subsistence-forager']).toBeUndefined();
      expect(profile.skills['governance']).toBeDefined();
    });

    test('civil-servant has administration skill, not regular employment', () => {
      const profile = CITIZEN_STATUS_PROFILES['civil-servant'];
      expect(profile.skills['subsistence-forager']).toBeDefined();
      expect(profile.skills['administration']).toBeDefined();
      expect(profile.skills['employment-eligible']).toBeUndefined();
    });
  });

  describe('Housing Metadata (descriptive documentation)', () => {
    test('all statuses have housingMetadata', () => {
      for (const [key, profile] of Object.entries(CITIZEN_STATUS_PROFILES)) {
        expect(profile.housingMetadata).toBeDefined();
        expect(profile.housingMetadata.constraint).toBeDefined();
        expect(profile.housingMetadata.description).toBeDefined();
        expect(typeof profile.housingMetadata.description).toBe('string');
      }
    });

    test('hunter-gatherer lives in level 1 (cabane)', () => {
      const profile = getCitizenStatusProfile('hunter-gatherer');
      expect(profile.housingMetadata.typicalLevel).toBe(1);
      expect(profile.housingMetadata.constraint).toBe('none');
      expect(profile.housingMetadata.description).toContain('cabane');
      expect(profile.housingMetadata.description).toContain('niveau 1');
    });

    test('worker lives in level 2 (masure)', () => {
      const profile = getCitizenStatusProfile('worker');
      expect(profile.housingMetadata.typicalLevel).toBe(2);
      expect(profile.housingMetadata.constraint).toBe('none');
      expect(profile.housingMetadata.description).toContain('masure');
      expect(profile.housingMetadata.description).toContain('niveau 2');
    });

    test('unemployed lives in level 2 (same as worker)', () => {
      const profile = getCitizenStatusProfile('unemployed');
      expect(profile.housingMetadata.typicalLevel).toBe(2);
      expect(profile.housingMetadata.constraint).toBe('none');
    });

    test('civil-servant lives in level 2', () => {
      const profile = getCitizenStatusProfile('civil-servant');
      expect(profile.housingMetadata.typicalLevel).toBe(2);
      expect(profile.housingMetadata.constraint).toBe('none');
    });

    test('elite lives in level 2 (like other workers)', () => {
      const profile = getCitizenStatusProfile('elite');
      expect(profile.housingMetadata.typicalLevel).toBe(2);
      expect(profile.housingMetadata.constraint).toBe('none');
    });

    test('youth is parent-dependent', () => {
      const profile = getCitizenStatusProfile('youth');
      expect(profile.housingMetadata.typicalLevel).toBe(null); // Depends on parents
      expect(profile.housingMetadata.constraint).toBe('parent-dependent');
      expect(profile.housingMetadata.description).toContain('parents');
    });

    test('retired lives in level 2 (former worker)', () => {
      const profile = getCitizenStatusProfile('retired');
      expect(profile.housingMetadata.typicalLevel).toBe(2);
      expect(profile.housingMetadata.constraint).toBe('none');
    });

    test('housingMetadata is frozen (immutable)', () => {
      for (const [key, profile] of Object.entries(CITIZEN_STATUS_PROFILES)) {
        expect(Object.isFrozen(profile.housingMetadata)).toBe(true);
      }
    });

    test('constraint values are valid', () => {
      const validConstraints = ['none', 'parent-dependent'];
      for (const [key, profile] of Object.entries(CITIZEN_STATUS_PROFILES)) {
        expect(validConstraints).toContain(profile.housingMetadata.constraint);
      }
    });

    test('typicalLevel is valid (1, 2, or null)', () => {
      const validLevels = [1, 2, null];
      for (const [key, profile] of Object.entries(CITIZEN_STATUS_PROFILES)) {
        expect(validLevels).toContain(profile.housingMetadata.typicalLevel);
      }
    });
  });
});
