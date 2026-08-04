/**
 * Behavior tests — Accounting: CitizenTaxCollectionPolicy
 *
 * Level 1 (autarky) houses are self-sufficient and exempt from citizen tax —
 * only level 2 (group profession, road-connected) houses pay. See
 * `docs/gameplay/proposal.md` Phase 3.
 */

import { describe, test, expect } from '@jest/globals';
import { computeCitizenTaxBreakdown } from '../../../src/contexts/accounting/domain/policies/CitizenTaxCollectionPolicy.js';

describe('Accounting — CitizenTaxCollectionPolicy', () => {
  test('taxes level 2 houses per capita, split by color', () => {
    const breakdown = computeCitizenTaxBreakdown(
      [
        { type: 'House-Blue', pop: 3, level: 2 },
        { type: 'House-Red', pop: 4, level: 2 },
      ],
      100
    );

    expect(breakdown['House-Blue']).toBe(300);
    expect(breakdown['House-Red']).toBe(400);
    expect(breakdown['House-Purple']).toBe(0);
    expect(breakdown.total).toBe(700);
    expect(breakdown.population).toBe(7);
  });

  test('exempts level 1 (autarkic) houses entirely', () => {
    const breakdown = computeCitizenTaxBreakdown(
      [
        { type: 'House-Blue', pop: 5, level: 1 },
        { type: 'House-Red', pop: 4, level: 2 },
      ],
      100
    );

    expect(breakdown['House-Blue']).toBe(0);
    expect(breakdown['House-Red']).toBe(400);
    expect(breakdown.total).toBe(400);
    expect(breakdown.population).toBe(4);
  });

  test('missing level defaults to 1 (exempt) — matches Housing default for un-migrated rows', () => {
    const breakdown = computeCitizenTaxBreakdown([{ type: 'House-Purple', pop: 6 }], 100);

    expect(breakdown['House-Purple']).toBe(0);
    expect(breakdown.total).toBe(0);
  });

  test('ignores non-residential and unpopulated houses', () => {
    const breakdown = computeCitizenTaxBreakdown(
      [
        { type: 'Farm-Wheat', pop: 10, level: 2 },
        { type: 'House-Red', pop: 0, level: 2 },
      ],
      100
    );

    expect(breakdown.total).toBe(0);
    expect(breakdown.population).toBe(0);
  });
});
