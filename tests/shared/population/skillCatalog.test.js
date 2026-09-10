import { describe, test, expect } from '@jest/globals';
import { SKILL_CATALOG, getSkillDisplay } from '../../../src/shared/population/skillCatalog.js';

describe('skillCatalog — single source of truth for skill display', () => {
  test('getSkillDisplay returns the curated entry for a known skill', () => {
    expect(getSkillDisplay('spiritual')).toEqual({ label: 'Spiritualité', emoji: '🙏' });
  });

  test('getSkillDisplay falls back to a humanized label for an uncurated skill id', () => {
    expect(getSkillDisplay('future-skill')).toEqual({ label: 'Future Skill', emoji: '🔧' });
  });

  test('every curated entry has a label and an emoji', () => {
    for (const meta of Object.values(SKILL_CATALOG)) {
      expect(typeof meta.label).toBe('string');
      expect(typeof meta.emoji).toBe('string');
    }
  });
});
