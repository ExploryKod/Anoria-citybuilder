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
      expect.objectContaining({ statusKey: 'worker', count: 12, label: 'citoyens artisans' }),
    ]);
    expect(skills).toEqual([
      expect.objectContaining({ skillKey: 'fermier', label: 'fermier' }),
      expect.objectContaining({ skillKey: 'artisanat', label: 'artisanat' }),
      expect.objectContaining({ skillKey: 'energie', label: 'énergie' }),
    ]);
  });

  test('a level-1 (tier 1) house lists ALL its skills, each with its own label — the exact bug this pins', () => {
    const composition = computeHouseCitizenComposition({
      level: 1,
      pop: 5,
      buildingType: 'House-Blue',
      residentialGroup: 'merchants',
    });

    const { skills } = formatHousePopulationPresentation(composition, 'merchants');

    expect(skills).toEqual([
      expect.objectContaining({ skillKey: 'vente-alimentaire' }),
      expect.objectContaining({ skillKey: 'stockage-alimentaire' }),
    ]);
  });

  test('a skill the catalog grants but SKILL_CATALOG has no curated entry for is shown as the "…" marker, not a label made up from its id', () => {
    const composition = { profiles: [], skills: { 'future-skill': 3 } };

    const { skills } = formatHousePopulationPresentation(composition, null);

    expect(skills).toEqual([
      expect.objectContaining({ skillKey: 'future-skill', label: '…', emoji: '…' }),
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
