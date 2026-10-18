/**
 * The journal export keeps every stored field.
 */

import { describe, test, expect } from '@jest/globals';
import { buildJournalExportPayload } from '../../../src/contexts/accounting/presentation/JournalExportViewModel.js';

describe('journal export — every stored field is kept', () => {
  test('hamletId, year, month, businessKey and buildingInstanceId survive the export', () => {
    const stored = {
      id: 7,
      turn: 165,
      date: '2026-10-04T09:25:18.840Z',
      type: 'salary',
      amount: 300,
      description: 'Salaires fonctionnaires - Octobre 2 ap JC',
      hamletId: 'a1b2c3d4-0000-4000-8000-000000000000',
      year: 2,
      month: 10,
      businessKey: 'salary:2:9',
      buildingInstanceId: 'bld-1',
    };
    const payload = buildJournalExportPayload({
      entries: [stored],
      yearlySummary: [],
    });
    expect(payload.entries[0]).toEqual(stored);
  });
});
