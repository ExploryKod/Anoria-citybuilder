import { describe, test, expect } from '@jest/globals';
import { computeHouseCitizenComposition } from '../../../../src/contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js';
import { formatHousePopulationPresentation } from '../../../../src/presentation/dom/info/population/formatHousePopulationPresentation.js';

describe('formatHousePopulationPresentation', () => {
  test('formats housing composition with French labels', () => {
    const composition = computeHouseCitizenComposition({
      level: 2,
      pop: 12,
      buildingType: 'House-Red',
      residentialGroup: 'artisans-ouvriers',
    });

    const { profiles, skills } = formatHousePopulationPresentation(
      composition,
      'artisans-ouvriers',
    );

    expect(profiles).toEqual([
      expect.objectContaining({ statusKey: 'worker', count: 12, label: 'citoyens artisans' }),
    ]);
    expect(skills).toEqual([
      expect.objectContaining({ skillKey: 'subsistence-forager', count: 12, label: 'chasse-cueillette' }),
      expect.objectContaining({ skillKey: 'fermier', count: 12, label: 'fermier' }),
    ]);
  });
});
