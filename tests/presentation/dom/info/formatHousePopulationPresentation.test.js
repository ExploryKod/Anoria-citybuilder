import { describe, test, expect } from '@jest/globals';
import { computeHouseCitizenComposition } from '../../../../src/contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js';
import { formatHousePopulationPresentation } from '../../../../src/presentation/dom/info/population/formatHousePopulationPresentation.js';
import { SOCIAL_CATEGORY } from '../../../../src/shared/population/socialCategoryCatalog.js';
import { SKILL_CATALOG } from '../../../../src/shared/population/skillCatalog.js';

describe('formatHousePopulationPresentation', () => {
  test('formats housing composition with French labels', () => {
    const composition = computeHouseCitizenComposition({
      level: 2,
      pop: 12,
      buildingType: 'House-Red',
      residentialGroup: 'artisans',
    });

    const { profiles, skills } = formatHousePopulationPresentation(
      composition,
      'artisans',
    );

    expect(profiles).toEqual([
      expect.objectContaining({ statusKey: 'worker', count: 12, label: 'citoyens artisans-ouvriers' }),
    ]);
    expect(skills).toEqual([
      expect.objectContaining({ skillKey: 'subsistence-forager', count: 12, label: 'chasse-cueillette' }),
      expect.objectContaining({ skillKey: 'spiritual', count: 12, label: 'spiritualité' }),
      expect.objectContaining({ skillKey: 'fermier', count: 12, label: 'fermier' }),
      expect.objectContaining({ skillKey: 'artisanat', count: 12, label: 'artisanat' }),
    ]);
  });

  test('a level-1 (tier 1) house lists BOTH its skills, including spiritual — the exact bug this pins', () => {
    const composition = computeHouseCitizenComposition({
      level: 1,
      pop: 5,
      buildingType: 'House-Blue',
      residentialGroup: 'merchants',
    });

    const { skills } = formatHousePopulationPresentation(composition, 'merchants');

    expect(skills).toEqual([
      expect.objectContaining({ skillKey: 'subsistence-forager', count: 5 }),
      expect.objectContaining({ skillKey: 'spiritual', count: 5, label: 'spiritualité' }),
    ]);
  });

  test('a skill the catalog grants but SKILL_CATALOG has no curated entry for still displays (humanized fallback)', () => {
    const composition = { profiles: [], skills: { 'future-skill': 3 } };

    const { skills } = formatHousePopulationPresentation(composition, null);

    expect(skills).toEqual([
      expect.objectContaining({ skillKey: 'future-skill', count: 3, label: 'future skill', emoji: '🔧' }),
    ]);
  });

  test('contract: every skill declared anywhere in SOCIAL_CATEGORY has a curated SKILL_CATALOG entry', () => {
    const declaredSkills = new Set(
      Object.values(SOCIAL_CATEGORY).flatMap((facts) =>
        Object.values(facts.tiers).flatMap((tier) => Object.keys(tier.skills)),
      ),
    );
    for (const skill of declaredSkills) {
      expect(SKILL_CATALOG[skill]).toBeDefined();
    }
  });
});
