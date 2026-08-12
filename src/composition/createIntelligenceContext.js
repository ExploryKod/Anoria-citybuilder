import { DexieNewsItemRepository } from '../contexts/intelligence/infrastructure/dexie/DexieNewsItemRepository.js';
import { GenerateMonthlyCityNews } from '../contexts/intelligence/application/commands/GenerateMonthlyCityNews.js';
import { ArchiveNewsItem } from '../contexts/intelligence/application/commands/ArchiveNewsItem.js';
import { DeleteNewsItem } from '../contexts/intelligence/application/commands/DeleteNewsItem.js';
import { ListIncomingNews } from '../contexts/intelligence/application/queries/ListIncomingNews.js';
import { ListArchivedNews } from '../contexts/intelligence/application/queries/ListArchivedNews.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';

/**
 * Composition root — Intelligence bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/intelligence/application/ports/NewsItemRepository.js').NewsItemRepository} [deps.newsItemRepository]
 * @param {() => Promise<{ famishedPopulation: number, totalPopulation: number }>} [deps.getFamishedSummary]
 * @param {() => Promise<{ unemploymentPercentage: number, lack: number }>} [deps.getEmploymentSummary]
 */
export function createIntelligenceContext({
  newsItemRepository,
  getFamishedSummary,
  getEmploymentSummary,
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

  const generateMonthlyCityNewsCmd = new GenerateMonthlyCityNews(repository, {
    getFamishedSummary: resolveFamished,
    getEmploymentSummary: resolveEmployment,
  });
  const archiveNewsItemCmd = new ArchiveNewsItem(repository);
  const deleteNewsItemCmd = new DeleteNewsItem(repository);
  const listIncomingNewsQuery = new ListIncomingNews(repository);
  const listArchivedNewsQuery = new ListArchivedNews(repository);

  return {
    newsItemRepository: repository,
    generateMonthlyCityNewsCmd,
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
