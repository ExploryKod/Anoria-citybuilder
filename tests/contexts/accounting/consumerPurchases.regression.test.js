/**
 * A delivery of goods to a house is three lines: the house pays the price with VAT, the seller books the sale without it, the city books the VAT. The journal
 * refuses a second line with the same business key, so each line has its own: with one key for the three, only the house's purchase was written and the
 * seller never received what the house paid, nor the city the VAT.
 */
import { describe, test, expect } from '@jest/globals';
import { RecordConsumerPurchases } from '../../../src/contexts/accounting/application/services/RecordConsumerPurchases.js';
import { TEST_HAMLET_ID } from '../../helpers/testHamlet.js';
import { unpairedFlowsOf } from '../../../src/contexts/accounting/domain/policies/TransactionLinkPolicy.js';
import { booked } from '../../helpers/booked.js';

/** The journal as it refuses a duplicate business key, the way the real one does. */
function journalThatRefusesDuplicates() {
  const lines = [];
  return {
    lines,
    recordLedgerEntry: async (line) => {
      if (lines.some((written) => written.businessKey === line.businessKey)) return { recorded: false, reason: 'duplicate_business_key' };
      lines.push(booked({ ...line, hamletId: TEST_HAMLET_ID, year: 1, month: 3 }));
      return { recorded: true };
    },
  };
}

const delivery = (journal) =>
  new RecordConsumerPurchases({ getVatRates: async () => ({ wheat: 10 }), recordLedgerEntry: journal.recordLedgerEntry }).execute({
    turn: 70,
    timeInfo: { month: 'Mars', year: 1 },
    distributorId: 'stall',
    distributorType: 'Market-Stall-Red',
    purchases: [{ houseId: 'house-1', category: 'wheat', units: 10, unitPrice: 1.1 }],
  });

describe('RecordConsumerPurchases — a delivery to a house is three lines, each written', () => {
  test('the house pays the price with VAT, the seller books the sale without it, the city the VAT', async () => {
    const journal = journalThatRefusesDuplicates();

    await delivery(journal);

    expect(journal.lines.map((line) => [line.type, line.amount, line.accountBuildingId])).toEqual([
      ['consumer_purchase', 11, 'house-1'],
      ['producer_revenue', 10, 'stall'],
      ['vat', 1, null],
    ]);
    expect(unpairedFlowsOf(journal.lines).lonely).toEqual([]);
  });

  test('a delivery is written once: the same delivery again adds nothing', async () => {
    const journal = journalThatRefusesDuplicates();

    await delivery(journal);
    await delivery(journal);

    expect(journal.lines).toHaveLength(3);
  });
});
