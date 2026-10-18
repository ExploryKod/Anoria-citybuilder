import { describe, test, expect } from '@jest/globals';
import { employmentShortfallCauses, sumShortfallCauses } from '../../../src/contexts/employment/domain/policies/EmploymentShortfallPolicy.js';
import { houseUnemploymentCauses } from '../../../src/shared/population/workforceQueries.js';

// A house's unemployed: out of work for lack of the skill the vacant posts of their class ask for, or because no post is free for them.
describe('why the residents of one house are out of work', () => {
  const classGrants = (skill) => skill === 'medical';
  const vacancies = [{ skill: 'medical', level: 2, vacancies: 3 }, { skill: 'artisanat', level: 1, vacancies: 5 }];

  test('as many unemployed as there are vacant posts of their class that the house cannot staff lack the skill; the others find no post', () => {
    const houseHolds = (skill, level) => skill === 'medical' && level <= 1;
    expect(houseUnemploymentCauses({ unemployed: 4, vacancies, classGrants, houseHolds })).toEqual({ noSkill: 3, noPost: 1 });
    expect(houseUnemploymentCauses({ unemployed: 2, vacancies, classGrants, houseHolds })).toEqual({ noSkill: 2, noPost: 0 });
  });

  test('a post the house could staff, or one of another class, does not make the unemployed lack a skill', () => {
    expect(houseUnemploymentCauses({ unemployed: 4, vacancies, classGrants, houseHolds: () => true })).toEqual({ noSkill: 0, noPost: 4 });
    expect(houseUnemploymentCauses({ unemployed: 4, vacancies: [{ skill: 'artisanat', level: 1, vacancies: 5 }], classGrants, houseHolds: () => false })).toEqual({ noSkill: 0, noPost: 4 });
  });
});

// Out of work and empty posts at the same time are a mismatch of skills; what is left over on either side is a real shortage.
describe('why people are out of work and why posts stay empty', () => {
  test('unemployed and vacancies together are a skill mismatch; the rest of each side is a real shortage', () => {
    expect(employmentShortfallCauses({ unemployed: 5, unemployedNoRoad: 0, lack: 3 })).toEqual({
      unemployedNoSkill: 3, unemployedNoPosts: 2, unemployedNoRoad: 0, lackNoSkill: 3, lackNoHands: 0,
    });
    expect(employmentShortfallCauses({ unemployed: 1, unemployedNoRoad: 0, lack: 4 })).toEqual({
      unemployedNoSkill: 1, unemployedNoPosts: 0, unemployedNoRoad: 0, lackNoSkill: 1, lackNoHands: 3,
    });
  });

  test('no vacancy at all: all the unemployed lack posts; nobody out of work: all the vacancies lack hands', () => {
    expect(employmentShortfallCauses({ unemployed: 4, unemployedNoRoad: 0, lack: 0 })).toMatchObject({ unemployedNoSkill: 0, unemployedNoPosts: 4 });
    expect(employmentShortfallCauses({ unemployed: 0, unemployedNoRoad: 0, lack: 6 })).toMatchObject({ lackNoSkill: 0, lackNoHands: 6 });
  });

  test('citizens whose house has no road are out of work for that reason alone, and are not matched to vacancies', () => {
    expect(employmentShortfallCauses({ unemployed: 3, unemployedNoRoad: 3, lack: 2 })).toEqual({
      unemployedNoSkill: 0, unemployedNoPosts: 0, unemployedNoRoad: 3, lackNoSkill: 0, lackNoHands: 2,
    });
  });

  test('the country adds up its hamlets: they are not matched against each other', () => {
    const a = employmentShortfallCauses({ unemployed: 2, unemployedNoRoad: 0, lack: 0 });
    const b = employmentShortfallCauses({ unemployed: 0, unemployedNoRoad: 0, lack: 2 });
    expect(sumShortfallCauses([a, b])).toMatchObject({ unemployedNoSkill: 0, unemployedNoPosts: 2, lackNoSkill: 0, lackNoHands: 2 });
  });
});
