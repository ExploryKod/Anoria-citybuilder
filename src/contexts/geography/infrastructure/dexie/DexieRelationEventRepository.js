import db from '../../../../core/persistence/dexie/db.js';
import { embargoesIn } from '../../domain/policies/RelationMemoryPolicy.js';

/**
 * The journal of a relation's events (RelationMemoryPolicy.js): appended, never edited, never purged. The year and the month are stamped when the event is written.
 */
export class DexieRelationEventRepository {
  /** @param {import('../../domain/policies/RelationMemoryPolicy.js').RelationEvent} event @returns {Promise<void>} */
  async record(event) {
    await db.relationEvents.add(event);
  }

  /** @param {string} cityId @returns {Promise<import('../../domain/policies/RelationMemoryPolicy.js').RelationEvent[]>} the events of one relation, oldest first */
  async listOf(cityId) {
    return db.relationEvents.where('cityId').equals(cityId).sortBy('turn');
  }

  /** @param {string} cityId @param {string} kind @returns {Promise<import('../../domain/policies/RelationMemoryPolicy.js').RelationEvent | null>} the last event of this kind with this partner */
  async lastOfKind(cityId, kind) {
    const events = await this.listOf(cityId);
    return events.filter((event) => event.kind === kind).at(-1) ?? null;
  }

  /** @param {string} cityId @returns {Promise<Set<string>>} the embargoes the city has in force with this partner (`embargoKey`s), read from the journal */
  async embargoesOf(cityId) {
    return embargoesIn(await this.listOf(cityId));
  }

  /**
   * The last customs event of one good in one flow with one partner: it says whether our duty is above its tolerance now.
   * @param {string} cityId @param {string} good @param {'export' | 'import'} flow
   * @returns {Promise<import('../../domain/policies/RelationMemoryPolicy.js').RelationEvent | null>}
   */
  async lastCustoms(cityId, good, flow) {
    const events = await this.listOf(cityId);
    return events.filter((event) => event.kind.startsWith('customs_') && event.good === good && event.flow === flow).at(-1) ?? null;
  }
}
