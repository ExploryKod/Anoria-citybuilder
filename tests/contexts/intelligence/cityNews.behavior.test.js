/**
 * Behavior tests — Intelligence: city news generation policy
 */

import { describe, test, expect } from '@jest/globals';
import { planCityNewsDrafts } from '../../../src/contexts/intelligence/domain/policies/CityNewsGenerationPolicy.js';
import { CITY_NEWS_ENTRIES_MVP } from '../../../src/contexts/intelligence/domain/catalogs/NewsDraftCatalog.js';
import { createNewsItem } from '../../../src/contexts/intelligence/domain/NewsItem.js';
import { GenerateMonthlyCityNews } from '../../../src/contexts/intelligence/application/commands/GenerateMonthlyCityNews.js';
import { ArchiveNewsItem } from '../../../src/contexts/intelligence/application/commands/ArchiveNewsItem.js';

class InMemoryNewsRepo {
  constructor() {
    /** @type {Map<string, object>} */
    this.items = new Map();
  }

  async save(item) {
    this.items.set(item.id, { ...item });
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async deleteById(id) {
    this.items.delete(id);
  }

  async hasAnyForTurnAndSource(turn, sourceId) {
    return [...this.items.values()].some((i) => i.turn === turn && i.sourceId === sourceId);
  }

  async listIncoming() {
    return [...this.items.values()].filter((i) => i.lifecycle === 'incoming');
  }

  async listArchived() {
    return [...this.items.values()].filter((i) => i.lifecycle === 'archived');
  }
}

describe('Intelligence — city news', () => {
  test('planCityNewsDrafts prioritizes famine revelation and caps at 2', () => {
    const drafts = planCityNewsDrafts({
      turn: 30,
      signals: {
        famishedPopulation: 40,
        totalPopulation: 100,
        unemploymentPercentage: 40,
        lack: 12,
      },
      rng: () => 0,
      entries: CITY_NEWS_ENTRIES_MVP,
    });
    expect(drafts.length).toBeLessThanOrEqual(2);
    expect(drafts[0].categoryId).toBe('revelation');
    expect(drafts.every((d) => d.revelation === 'free')).toBe(true);
  });

  test('GenerateMonthlyCityNews is idempotent per turn', async () => {
    const repo = new InMemoryNewsRepo();
    const cmd = new GenerateMonthlyCityNews(repo, {
      getFamishedSummary: async () => ({
        famishedPopulation: 5,
        totalPopulation: 50,
      }),
      getEmploymentSummary: async () => ({
        unemploymentPercentage: 0,
        lack: 0,
      }),
      rng: () => 0,
    });

    const first = await cmd.execute({ turn: 10 });
    const second = await cmd.execute({ turn: 10 });
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(await repo.listIncoming()).toHaveLength(0);
  });

  test('ArchiveNewsItem moves incoming to archived', async () => {
    const repo = new InMemoryNewsRepo();
    const item = createNewsItem({
      id: 'n1',
      turn: 4,
      sourceId: 'city',
      categoryId: 'complaint',
      title: 'Test',
      body: 'Corps',
      lifecycle: 'incoming',
      revelation: 'free',
    });
    await repo.save(item);

    const archived = await new ArchiveNewsItem(repo).execute({
      newsItemId: 'n1',
      turn: 5,
    });
    expect(archived.lifecycle).toBe('archived');
    expect(archived.readAtTurn).toBe(5);
    expect(await repo.listIncoming()).toHaveLength(0);
    expect(await repo.listArchived()).toHaveLength(1);
  });
});
