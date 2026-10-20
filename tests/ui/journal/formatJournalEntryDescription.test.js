import { describe, test, expect } from '@jest/globals';
import {
  formatJournalEntryDescription,
  formatJournalEntryDetails,
} from '../../../src/presentation/dom/compta/journal/formatJournalEntryDescription.js';

describe('formatJournalEntryDescription', () => {
  test('payroll_tax shows labeled rate without month repetition', () => {
    expect(
      formatJournalEntryDetails({
        type: 'payroll_tax',
        description: 'Impôt sur le revenu (IR) - Juin 0 JC (20%)',
      })
    ).toEqual([{ label: 'Taux', value: '20%' }]);
  });

  test('salary shows labeled calculation without month repetition', () => {
    expect(
      formatJournalEntryDetails({
        type: 'salary',
        description: 'Salaires fonctionnaires - Juin 0 JC (2 fonct. × 100€)',
      })
    ).toEqual([{ label: 'Calcul fonctionnaires', value: '2 fonct. × 100€' }]);
  });

  test('maintenance hides period-only description when breakdown exists', () => {
    expect(
      formatJournalEntryDetails({
        type: 'maintenance',
        description: 'Maintenance mensuelle - Juin 3',
      })
    ).toEqual([]);
  });

  test('citizen_tax shows labeled population without month repetition', () => {
    expect(
      formatJournalEntryDetails({
        type: 'citizen_tax',
        description: 'Impôt Citoyen (24 hab.) - Novembre',
      })
    ).toEqual([{ label: 'Population', value: '24 hab.' }]);
  });

  test('construction shows labeled building name', () => {
    expect(
      formatJournalEntryDetails({
        type: 'construction',
        description: 'Building: Farm-Cabbage',
      })
    ).toEqual([{ label: 'Bâtiment', value: 'Farm-Cabbage' }]);
  });

  test('construction shows labeled building name only (building id is in meta line)', () => {
    expect(
      formatJournalEntryDetails({
        type: 'construction',
        description: 'Building: Farm-Cabbage',
        buildingInstanceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
    ).toEqual([{ label: 'Bâtiment', value: 'Farm-Cabbage' }]);
  });

  test('formatJournalEntryDescription joins labeled facts', () => {
    expect(
      formatJournalEntryDescription({
        type: 'payroll_tax',
        description: 'Impôt sur le revenu (IR) - Juin 0 JC (20%)',
      })
    ).toBe('Taux: 20%');
  });
});
