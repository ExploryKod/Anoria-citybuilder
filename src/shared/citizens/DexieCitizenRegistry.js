import Dexie from 'dexie';
import db from '../../core/persistence/dexie/db.js';
import { createCitizen, drawArrivingCitizen, planHousePopulation, inHouseOrder, withWorkplace } from './Citizen.js';

/**
 * The citizens of the game: the only way in or out of the `citizens` table.
 *
 * IndexedDB is touched by batch, never per citizen:
 * - a read is ONE indexed query for a whole hamlet (`forHamlet`), kept in memory afterwards; a house is read from that memory;
 * - a write is the delta of one house (`bulkAdd` of the arrivals, `bulkDelete` of the leavers) inside the transaction that also
 *   writes the house. The house's `pop` is not stored: it is the count of these citizens (core/persistence/dexie/residentsProjection.js).
 *
 * The cache of a hamlet is dropped when a transaction that changed its citizens commits, and rebuilt by the next read.
 */
export class DexieCitizenRegistry {
  /** @type {Map<string, Map<string, import('./Citizen.js').Citizen[]>>} citizens by house, by hamlet */
  #byHamlet = new Map();

  /**
   * @param {{ currentTurn: () => number, random: () => number, newId: () => string }} deps the clock, the random source and the
   *   identity source: the composition's to give, none has a stand-in here.
   */
  constructor({ currentTurn, random, newId } = {}) {
    for (const [name, dep] of Object.entries({ currentTurn, random, newId })) {
      if (typeof dep !== 'function') throw new Error(`[citizens] the registry needs its ${name}`);
    }
    this.currentTurn = currentTurn;
    this.random = random;
    this.newId = newId;
  }

  /**
   * Every citizen of a hamlet, by house, each house in its stable order. One query, then the memory.
   * @param {string} hamletId
   * @returns {Promise<Map<string, import('./Citizen.js').Citizen[]>>}
   */
  async forHamlet(hamletId) {
    if (!hamletId) throw new Error('[citizens] a hamlet is needed to read its citizens');
    const cached = this.#byHamlet.get(hamletId);
    if (cached) return cached;
    const rows = await db.citizens.where('hamletId').equals(hamletId).toArray();
    const byHouse = new Map();
    for (const row of rows) {
      const citizen = createCitizen(row);
      const list = byHouse.get(citizen.houseId);
      if (list) list.push(citizen);
      else byHouse.set(citizen.houseId, [citizen]);
    }
    for (const [houseId, list] of byHouse) byHouse.set(houseId, inHouseOrder(list));
    this.#byHamlet.set(hamletId, byHouse);
    return byHouse;
  }

  /**
   * The citizens of a house, in their stable order: its residents (a house nobody lives in has none).
   * @param {{ houseId: string, hamletId: string }} house
   */
  async forHouse({ houseId, hamletId }) {
    return (await this.forHamlet(hamletId)).get(houseId) ?? [];
  }

  /**
   * Bring the citizens of a house to its new population: the latest arrivals leave first, newcomers are drawn at this turn.
   * Must run inside the transaction that writes the house row (it throws outside one).
   * @param {{ houseId: string, hamletId: string, pop: number }} params
   * @returns {Promise<void>}
   */
  async setHousePopulation({ houseId, hamletId, pop }) {
    const transaction = Dexie.currentTransaction;
    if (!transaction) throw new Error(`[citizens] house ${houseId}: its population must be written in the transaction of its row`);
    const current = (await db.citizens.where('houseId').equals(houseId).toArray()).map(createCitizen);
    const { arrivals, leaving } = planHousePopulation({ citizens: current, targetPop: pop });
    if (arrivals === 0 && leaving.length === 0) return;
    const turn = this.currentTurn();
    const arriving = Array.from({ length: arrivals }, () =>
      drawArrivingCitizen({ houseId, hamletId, turn, random: this.random, newId: this.newId }));
    if (leaving.length > 0) await db.citizens.bulkDelete(leaving.map((citizen) => citizen.id));
    if (arriving.length > 0) await db.citizens.bulkAdd(arriving.map((citizen) => ({ ...citizen })));
    this.#dropOnCommit(transaction, hamletId);
  }

  /**
   * Write the new health of citizens (their identity unchanged), in one `bulkPut`. Inside the transaction of the house's row.
   * @param {ReadonlyArray<import('./Citizen.js').Citizen>} citizens
   * @returns {Promise<void>}
   */
  async updateHealth(citizens) {
    const transaction = Dexie.currentTransaction;
    if (!transaction) throw new Error('[citizens] health must be written in the transaction of the house row');
    if (citizens.length === 0) return;
    await db.citizens.bulkPut(citizens.map((citizen) => ({ ...createCitizen(citizen) })));
    for (const hamletId of new Set(citizens.map((citizen) => citizen.hamletId))) this.#dropOnCommit(transaction, hamletId);
  }

  /**
   * Where citizens work now, as the employment has just named it: only the ones whose workplace changed are written, in one `bulkPut` and one transaction of their own (the
   * distribution of the workers runs outside a house's write). Everything else about them is left as it is.
   * @param {string} hamletId
   * @param {ReadonlyArray<{ citizen: import('./Citizen.js').Citizen, workplaceId: string | null }>} changes
   * @returns {Promise<void>}
   */
  async assignWorkplaces(hamletId, changes) {
    if (!hamletId) throw new Error('[citizens] a hamlet is needed to assign workplaces');
    if (changes.length === 0) return;
    await db.transaction('rw', db.citizens, async () => {
      await db.citizens.bulkPut(changes.map(({ citizen, workplaceId }) => ({ ...withWorkplace(citizen, workplaceId) })));
    });
    this.#byHamlet.delete(hamletId);
  }

  /**
   * Citizens who died: they leave, named one by one (unlike `setHousePopulation`, where the latest arrivals leave). Inside the transaction that writes their house's row.
   * @param {ReadonlyArray<import('./Citizen.js').Citizen>} citizens
   * @returns {Promise<void>}
   */
  async remove(citizens) {
    const transaction = Dexie.currentTransaction;
    if (!transaction) throw new Error('[citizens] a death must be written in the transaction of the house row');
    if (citizens.length === 0) return;
    await db.citizens.bulkDelete(citizens.map((citizen) => citizen.id));
    for (const hamletId of new Set(citizens.map((citizen) => citizen.hamletId))) this.#dropOnCommit(transaction, hamletId);
  }

  /**
   * The house is gone (demolished): so are its citizens. Inside the transaction that deletes the row.
   * @param {string} houseId
   * @returns {Promise<void>}
   */
  async removeHouse(houseId) {
    const transaction = Dexie.currentTransaction;
    if (!transaction) throw new Error(`[citizens] house ${houseId}: its citizens must be removed in the transaction of its row`);
    const rows = await db.citizens.where('houseId').equals(houseId).toArray();
    if (rows.length === 0) return;
    await db.citizens.bulkDelete(rows.map((row) => row.id));
    for (const hamletId of new Set(rows.map((row) => row.hamletId))) this.#dropOnCommit(transaction, hamletId);
  }

  #dropOnCommit(transaction, hamletId) {
    transaction.on('complete', () => this.#byHamlet.delete(hamletId));
  }

  /** @internal Tests only: forget what was read. */
  resetForTests() {
    this.#byHamlet.clear();
  }
}
