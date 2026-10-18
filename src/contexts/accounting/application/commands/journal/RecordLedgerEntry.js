import { buildLedgerBusinessKey } from '../../../domain/policies/LedgerIdempotencePolicy.js';
import { requireActiveHamletId } from '../../../../../core/persistence/hamlet/hamletSession.js';

/**
 * @typedef {object} RecordLedgerEntryResult
 * @property {boolean} recorded
 * @property {boolean} skipped
 * @property {string} [reason]
 * @property {string} [businessKey]
 */

/**
 * Command — append one operational journal line (idempotent when businessKey applies).
 */
export class RecordLedgerEntry {
  /**
   * @param {import('../../ports/JournalWritePort.js').JournalWritePort} journalWritePort
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   */
  constructor(journalWritePort, gameTimePort) {
    this.journalWritePort = journalWritePort;
    this.gameTimePort = gameTimePort;
  }

  /**
   * @param {object} params
   * @param {number} params.turn
   * @param {string} params.type
   * @param {number} params.amount
   * @param {string} params.description
   * @param {string|null} [params.businessKey]
   * @param {string|null} [params.partnerId]
   * @param {string|null} [params.buildingInstanceId]
   * @param {string|null} [params.accountBuildingId] the company whose own account the line moves; null for the city's
   * @param {string|null} [params.accountKind] which of a house's two accounts (particulier or entreprise); null for a company's
   * @param {string|null} [params.counterpartyBuildingId] the other company of a trade line (its trace); null when none
   * @param {number|null} [params.dutyRate] a customs line: the duty rate that was applied (stamped when written, never recomputed)
   * @param {number|null} [params.customsBase] a customs line: the value the rate was applied to
   * @param {string|null} [params.resource] a household's purchase line: the catalog category it bought (a good or a service), to group its budget by use
   * @param {Array<{ account: string, debit: number, credit: number }>|null} [params.legs] the legs of an écriture with more than two (centimes, balanced); null takes the two the catalog gives the type (the journal books every écriture when it writes it)
   * @param {string|null} [params.transactionId] ties the écritures of one flow between actors (each actor books its own)
   * @param {boolean} [params.persist]
   * @returns {Promise<RecordLedgerEntryResult>}
   */
  async execute({
    turn,
    type,
    amount,
    description,
    businessKey = null,
    partnerId = null,
    buildingInstanceId = null,
    accountBuildingId = null,
    accountKind = null,
    counterpartyBuildingId = null,
    loanId = null,
    loan = null,
    taxYear = null,
    taxBreakdown = null,
    dutyRate = null,
    customsBase = null,
    resource = null,
    legs = null,
    transactionId = null,
    persist,
  }) {
    if (typeof turn !== 'number' || Number.isNaN(turn)) {
      return { recorded: false, skipped: true, reason: 'invalid_turn' };
    }
    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      return { recorded: false, skipped: true, reason: 'invalid_amount' };
    }
    if (!type || typeof description !== 'string') {
      return { recorded: false, skipped: true, reason: 'invalid_payload' };
    }

    const timeInfo = this.gameTimePort.getTimeInfo(turn);
    const resolvedBusinessKey =
      businessKey ?? buildLedgerBusinessKey(type, timeInfo, requireActiveHamletId());

    const shouldPersist = persist ?? true;

    const appendResult = await this.journalWritePort.appendEntry(
      {
        turn,
        type,
        amount,
        description,
        partnerId,
        businessKey: resolvedBusinessKey,
        buildingInstanceId,
        accountBuildingId,
        accountKind,
        counterpartyBuildingId,
        loanId,
        loan,
        taxYear,
        taxBreakdown,
        dutyRate,
        customsBase,
        resource,
        legs,
        transactionId,
        month:
          timeInfo?.monthIndex != null ? timeInfo.monthIndex + 1 : null,
        year: timeInfo?.year ?? null,
      },
      { persist: shouldPersist }
    );

    if (appendResult.skipped) {
      return {
        recorded: false,
        skipped: true,
        reason: appendResult.reason ?? 'duplicate_business_key',
        businessKey: resolvedBusinessKey ?? undefined,
      };
    }

    return {
      recorded: true,
      skipped: false,
      businessKey: resolvedBusinessKey ?? undefined,
    };
  }
}
