import { benefactorOf } from '../../domain/policies/BenefactorGiftPolicy.js';

/**
 * Application service — the gift of a partner city (BenefactorGiftCatalog.js). Once per game:
 *   - `offerIfDue`: when the city has no money left and a benefactor trades with it, the offer is made (kept in the game's settings) and returned so the player is told;
 *   - `answer`: the player accepts (the gift is an écriture of the State, once: its business key) or refuses (nothing moves, for now it has no consequence).
 */
export class BenefactorGift {
  /**
   * @param {object} deps
   * @param {import('../../infrastructure/persistence/BenefactorGiftRepository.js').BenefactorGiftRepository} deps.repository
   * @param {() => Promise<boolean>} deps.borrowingOpen whether the city can still borrow (a bank that lends, debt under its ceiling)
   * @param {() => Promise<number>} deps.cityFunds the city's cash now, in euros (the treasury's)
   * @param {{ amount: number, firstYears: number, benefactors: ReadonlyArray<string> }} deps.catalog
   * @param {(turn: number) => { year: number }} deps.getTimeInfo
   * @param {() => number} deps.currentTurn
   * @param {(cityId: string) => string} deps.cityName the world's name of a city
   * @param {() => string} deps.hamletId
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {{ time: number, partnerIds: ReadonlyArray<string> }} params `partnerIds`: the cities the hamlet trades with now
   * @returns {Promise<{ cityId: string, cityName: string, amount: number } | null>} the offer just made; null when none is due (or one was made already)
   */
  async offerIfDue({ time, partnerIds }) {
    if (await this.deps.repository.get()) return null;
    const { amount, benefactors, firstYears } = this.deps.catalog;
    // Only a newcomer is helped: after the game's first years no gift is offered any more.
    if (this.deps.getTimeInfo(time).year >= firstYears) return null;
    const cityId = benefactorOf({ funds: await this.deps.cityFunds(), borrowingOpen: await this.deps.borrowingOpen(), partnerIds, benefactors });
    if (!cityId) return null;
    await this.deps.repository.save({ cityId, amount, turn: time, status: 'offered' });
    return { cityId, cityName: this.deps.cityName(cityId), amount };
  }

  /** @returns {Promise<{ cityId: string, cityName: string, amount: number, status: string } | null>} the offer and its answer; null while none was made */
  async current() {
    const gift = await this.deps.repository.get();
    return gift ? { ...gift, cityName: this.deps.cityName(gift.cityId) } : null;
  }

  /**
   * @param {{ accept: boolean }} params
   * @returns {Promise<{ status: 'accepted' | 'refused', amount: number }>}
   */
  async answer({ accept }) {
    const gift = await this.deps.repository.get();
    if (!gift) throw new Error('[benefactor-gift] no city has offered a gift: there is nothing to answer');
    if (gift.status !== 'offered') throw new Error(`[benefactor-gift] the gift of ${gift.cityId} was already ${gift.status}`);
    if (accept) {
      const result = await this.deps.recordLedgerEntry({
        turn: this.deps.currentTurn(),
        type: 'benefactor_gift',
        amount: gift.amount,
        description: `Don de ${this.deps.cityName(gift.cityId)} pour aider la ville à démarrer`,
        businessKey: `benefactor_gift:${this.deps.hamletId()}`,
        accountBuildingId: null,
        counterpartyBuildingId: null,
        partnerId: gift.cityId,
      });
      if (!result.recorded) throw new Error(`[benefactor-gift] the gift of ${gift.cityId} was not recorded: ${result.reason}`);
    }
    const status = accept ? 'accepted' : 'refused';
    await this.deps.repository.save({ ...gift, status });
    return { status, amount: gift.amount };
  }
}
