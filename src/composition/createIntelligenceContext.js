import { DexieNewsItemRepository } from '../contexts/intelligence/infrastructure/dexie/DexieNewsItemRepository.js';
import { GenerateMonthlyCityNews } from '../contexts/intelligence/application/commands/GenerateMonthlyCityNews.js';
import { GenerateMonthlyCaravanNews } from '../contexts/intelligence/application/commands/GenerateMonthlyCaravanNews.js';
import { AnnounceMilestone } from '../contexts/intelligence/application/commands/AnnounceMilestone.js';
import { AnnounceGuidance } from '../contexts/intelligence/application/commands/AnnounceGuidance.js';
import { PayForNewsItem } from '../contexts/intelligence/application/commands/PayForNewsItem.js';
import { ArchiveNewsItem } from '../contexts/intelligence/application/commands/ArchiveNewsItem.js';
import { DeleteNewsItem } from '../contexts/intelligence/application/commands/DeleteNewsItem.js';
import { ListIncomingNews } from '../contexts/intelligence/application/queries/ListIncomingNews.js';
import { ListArchivedNews } from '../contexts/intelligence/application/queries/ListArchivedNews.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';

/**
 * Composition root — Intelligence bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/intelligence/application/ports/NewsItemRepository.js').NewsItemRepository} [deps.newsItemRepository]
 * @param {() => Promise<{ famishedPopulation: number, totalPopulation: number }>} [deps.getFamishedSummary]
 * @param {() => Promise<{ unemploymentPercentage: number, lack: number }>} [deps.getEmploymentSummary]
 * @param {() => Promise<boolean>} [deps.hasOperationalBarn]
 * @param {() => boolean | Promise<boolean>} [deps.hasActiveTradeRoute]
 * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} [deps.settleContribution]
 * @param {(amount: number) => Promise<boolean>} [deps.canAfford]
 */
export function createIntelligenceContext({
  newsItemRepository,
  getFamishedSummary,
  getEmploymentSummary,
  hasOperationalBarn,
  hasActiveTradeRoute,
  settleContribution,
  canAfford,
} = {}) {
  const repository = newsItemRepository ?? new DexieNewsItemRepository();

  const resolveFamished =
    getFamishedSummary ??
    (async () => {
      const housing = getOrCreateHousingContext();
      return housing.getFamishedPopulation();
    });

  const resolveEmployment =
    getEmploymentSummary ??
    (async () => {
      const employment = getOrCreateEmploymentContext();
      const summary = await employment.getCityEmploymentSummary();
      return {
        unemploymentPercentage: summary?.unemploymentPercentage ?? 0,
        lack: summary?.lack ?? 0,
      };
    });

  const resolveBarn = hasOperationalBarn ?? (async () => false);

  const resolveTradeRoute = hasActiveTradeRoute ?? (() => false);

  const resolveSettle =
    settleContribution ??
    ((params) => getOrCreateAccountingContext().settleContribution(params));

  const resolveCanAfford =
    canAfford ?? ((amount) => getOrCreateAccountingContext().canAfford(amount));

  const generateMonthlyCityNewsCmd = new GenerateMonthlyCityNews(repository, {
    getFamishedSummary: resolveFamished,
    getEmploymentSummary: resolveEmployment,
  });
  const generateMonthlyCaravanNewsCmd = new GenerateMonthlyCaravanNews(repository, {
    hasOperationalBarn: resolveBarn,
    hasActiveTradeRoute: async () => resolveTradeRoute(),
  });
  const payForNewsItemCmd = new PayForNewsItem(repository, {
    settleContribution: resolveSettle,
  });
  const announceMilestoneCmd = new AnnounceMilestone(repository);
  const announceGuidanceCmd = new AnnounceGuidance(repository);
  const archiveNewsItemCmd = new ArchiveNewsItem(repository);
  const deleteNewsItemCmd = new DeleteNewsItem(repository);
  const listIncomingNewsQuery = new ListIncomingNews(repository);
  const listArchivedNewsQuery = new ListArchivedNews(repository);

  return {
    newsItemRepository: repository,
    generateMonthlyCityNewsCmd,
    generateMonthlyCaravanNewsCmd,
    payForNewsItemCmd,
    archiveNewsItemCmd,
    deleteNewsItemCmd,
    listIncomingNewsQuery,
    listArchivedNewsQuery,

    /**
     * @param {{ turn: number }} params
     */
    async generateMonthlyCityNews(params) {
      return generateMonthlyCityNewsCmd.execute(params);
    },

    /**
     * @param {{ turn: number }} params
     */
    async generateMonthlyCaravanNews(params) {
      return generateMonthlyCaravanNewsCmd.execute(params);
    },

    /**
     * City + caravan generation for the month start.
     * @param {{ turn: number }} params
     */
    async generateMonthlyNews(params) {
      const city = await generateMonthlyCityNewsCmd.execute(params);
      const caravan = await generateMonthlyCaravanNewsCmd.execute(params);
      return [...city, ...caravan];
    },

    /**
     * A dépêche that marks a moment of the game (the opening's treasure, the first mayor's house), written once per hamlet.
     * @param {{ milestoneId: string, turn: number, occurrence?: string | number, params?: object }} params
     */
    async announceMilestone(params) {
      return announceMilestoneCmd.execute(params);
    },

    /**
     * A dépêche another context wrote to guide the player (the tutorial's steps), filed once per guidance id and hamlet.
     * @param {Parameters<AnnounceGuidance['execute']>[0]} params
     */
    async announceGuidance(params) {
      return announceGuidanceCmd.execute(params);
    },

    /**
     * @param {{ newsItemId: string, turn: number }} params
     */
    async payForNewsItem(params) {
      return payForNewsItemCmd.execute(params);
    },

    /**
     * @param {number} amount
     */
    async canAffordContribution(amount) {
      return resolveCanAfford(amount);
    },

    /**
     * @param {{ newsItemId: string, turn: number }} params
     */
    async archiveNewsItem(params) {
      return archiveNewsItemCmd.execute(params);
    },

    /**
     * @param {{ newsItemId: string }} params
     */
    async deleteNewsItem(params) {
      return deleteNewsItemCmd.execute(params);
    },

    async listIncomingNews() {
      return listIncomingNewsQuery.execute();
    },

    async listArchivedNews() {
      return listArchivedNewsQuery.execute();
    },
  };
}

/** @type {ReturnType<typeof createIntelligenceContext> | null} */
let sharedIntelligence = null;

export function getOrCreateIntelligenceContext() {
  if (!sharedIntelligence) {
    sharedIntelligence = createIntelligenceContext();
  }
  return sharedIntelligence;
}

/** @internal Tests only */
export function resetIntelligenceContextForTests() {
  sharedIntelligence = null;
}
