import { DexieNewsItemRepository } from '../contexts/intelligence/infrastructure/dexie/DexieNewsItemRepository.js';
import { GenerateMonthlyCityNews } from '../contexts/intelligence/application/commands/GenerateMonthlyCityNews.js';
import { GenerateMonthlyCaravanNews } from '../contexts/intelligence/application/commands/GenerateMonthlyCaravanNews.js';
import { PayForNewsItem } from '../contexts/intelligence/application/commands/PayForNewsItem.js';
import { ArchiveNewsItem } from '../contexts/intelligence/application/commands/ArchiveNewsItem.js';
import { DeleteNewsItem } from '../contexts/intelligence/application/commands/DeleteNewsItem.js';
import { ListIncomingNews } from '../contexts/intelligence/application/queries/ListIncomingNews.js';
import { ListArchivedNews } from '../contexts/intelligence/application/queries/ListArchivedNews.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { getOrCreateCommerceContext } from './createCommerceContext.js';
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

  const resolveBarn =
    hasOperationalBarn ??
    (async () => getOrCreateSupplyContext().hasOperationalCommerceBarn());

  const resolveTradeRoute =
    hasActiveTradeRoute ??
    (() => {
      const partners =
        getOrCreateCommerceContext().commerceRepository.loadOrSeedPartners?.() ??
        getOrCreateCommerceContext().commerceRepository.loadPartners?.() ??
        [];
      return (partners || []).some((p) => p?.isActive === true);
    });

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
