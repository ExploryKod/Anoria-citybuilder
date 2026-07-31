import { buildLedgerBusinessKey } from '../../../domain/policies/LedgerIdempotencePolicy.js';

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
      businessKey ?? buildLedgerBusinessKey(type, timeInfo);

    if (resolvedBusinessKey && (await this.journalWritePort.hasBusinessKey(resolvedBusinessKey))) {
      return {
        recorded: false,
        skipped: true,
        reason: 'duplicate_business_key',
        businessKey: resolvedBusinessKey,
      };
    }

    const shouldPersist = persist ?? type !== 'balance';

    await this.journalWritePort.appendEntry(
      {
        turn,
        type,
        amount,
        description,
        partnerId,
        businessKey: resolvedBusinessKey,
        buildingInstanceId,
        month:
          timeInfo?.monthIndex != null ? timeInfo.monthIndex + 1 : null,
        year: timeInfo?.year ?? null,
      },
      { persist: shouldPersist }
    );

    return {
      recorded: true,
      skipped: false,
      businessKey: resolvedBusinessKey ?? undefined,
    };
  }
}
