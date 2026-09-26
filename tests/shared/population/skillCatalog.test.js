import { describe, test, expect } from '@jest/globals';
import { SKILL_CATALOG, getSkillDisplay } from '../../../src/shared/population/skillCatalog.js';

describe('skillCatalog — single source of truth for skill display', () => {
  test('getSkillDisplay returns the curated entry for a known skill', () => {
    expect(getSkillDisplay('spiritual')).toEqual({ label: 'Spiritualité', emoji: '🙏' });
  });

  test('getSkillDisplay shows the "…" marker for a skill the catalog does not name', () => {
    expect(getSkillDisplay('future-skill')).toEqual({ label: '…', emoji: '…' });
  });

  test('every curated entry has a label and an emoji', () => {
    for (const meta of Object.values(SKILL_CATALOG)) {
      expect(typeof meta.label).toBe('string');
      expect(typeof meta.emoji).toBe('string');
    }
  });
});
