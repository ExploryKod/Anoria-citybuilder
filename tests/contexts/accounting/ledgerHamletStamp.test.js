import { describe, expect, test } from '@jest/globals';
import { SessionLedgerBuffer } from '../../../src/contexts/accounting/infrastructure/session/SessionLedgerBuffer.js';

describe('ledger entries carry the hamlet they were created on', () => {
  test('an entry keeps the hamlet active when it was created, even if another hamlet is active later', () => {
    let activeHamlet = 'hamlet-a';
    const buffer = new SessionLedgerBuffer({ getHamletId: () => activeHamlet });

    const first = buffer.append({ turn: 1, type: 'citizen_tax', amount: 10 });
    activeHamlet = 'hamlet-b';
    const second = buffer.append({ turn: 2, type: 'citizen_tax', amount: 20 });

    expect(first.hamletId).toBe('hamlet-a');
    expect(second.hamletId).toBe('hamlet-b');
  });

  test('an explicit hamlet is kept as given', () => {
    const buffer = new SessionLedgerBuffer({ getHamletId: () => 'hamlet-a' });

    const record = buffer.append({ turn: 1, type: 'citizen_tax', amount: 10, hamletId: 'hamlet-c' });

    expect(record.hamletId).toBe('hamlet-c');
  });
});
