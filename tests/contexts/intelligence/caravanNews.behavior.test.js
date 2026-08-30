/**
 * Behavior tests — Intelligence Phase 2: caravan + paywall
 */

import { describe, test, expect } from '@jest/globals';
import { canGenerateCaravanNews, CARAVAN_NEWS_PRICE } from '../../../src/contexts/intelligence/domain/policies/CaravanNewsAccessPolicy.js';
import { planCaravanNewsDrafts } from '../../../src/contexts/intelligence/domain/policies/CaravanNewsGenerationPolicy.js';
import { CARAVAN_NEWS_ENTRIES_MVP } from '../../../src/contexts/intelligence/domain/catalogs/NewsDraftCatalog.js';
import { GenerateMonthlyCaravanNews } from '../../../src/contexts/intelligence/application/commands/GenerateMonthlyCaravanNews.js';
import { PayForNewsItem } from '../../../src/contexts/intelligence/application/commands/PayForNewsItem.js';
import { createNewsItem } from '../../../src/contexts/intelligence/domain/NewsItem.js';
import { buildContributionBusinessKey } from '../../../src/contexts/accounting/domain/policies/LedgerBusinessKeys.js';

class InMemoryNewsRepo {
  constructor() {
    this.items = new Map();
  }

  async save(item) {
    this.items.set(item.id, { ...item, access: { ...item.access } });
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

describe('Intelligence — caravan Phase 2', () => {
  test('caravan gates require barn and active route', () => {
    expect(
      canGenerateCaravanNews({ hasOperationalBarn: true, hasActiveTradeRoute: true })
    ).toBe(true);
    expect(
      canGenerateCaravanNews({ hasOperationalBarn: false, hasActiveTradeRoute: true })
    ).toBe(false);
    expect(
      canGenerateCaravanNews({ hasOperationalBarn: true, hasActiveTradeRoute: false })
    ).toBe(false);
  });

  test('planCaravanNewsDrafts yields unpaid priced drafts', () => {
    const drafts = planCaravanNewsDrafts({
      turn: 5,
      rng: () => 0,
      entries: CARAVAN_NEWS_ENTRIES_MVP,
    });
    expect(drafts.length).toBe(1);
    expect(drafts[0].revelation).toBe('unpaid');
    expect(drafts[0].price).toBe(CARAVAN_NEWS_PRICE);
    expect(drafts[0].sourceId).toBe('caravan');
  });

  test('GenerateMonthlyCaravanNews skips without assets', async () => {
    const repo = new InMemoryNewsRepo();
    const cmd = new GenerateMonthlyCaravanNews(repo, {
      hasOperationalBarn: async () => false,
      hasActiveTradeRoute: async () => true,
      rng: () => 0,
    });
    const created = await cmd.execute({ turn: 10 });
    expect(created).toEqual([]);
  });

  test('GenerateMonthlyCaravanNews does not create items while catalog is empty', async () => {
    const repo = new InMemoryNewsRepo();
    const cmd = new GenerateMonthlyCaravanNews(repo, {
      hasOperationalBarn: async () => true,
      hasActiveTradeRoute: async () => true,
      rng: () => 0,
    });
    const created = await cmd.execute({ turn: 10 });
    expect(created).toEqual([]);
  });

  test('PayForNewsItem settles then reveals', async () => {
    const repo = new InMemoryNewsRepo();
    const item = createNewsItem({
      id: 'news-1',
      turn: 10,
      sourceId: 'caravan',
      categoryId: 'trade_rumor',
      title: 'Test',
      body: 'Secret',
      lifecycle: 'incoming',
      revelation: 'unpaid',
      access: { price: 10 },
    });
    await repo.save(item);

    const settlements = [];
    const pay = new PayForNewsItem(repo, {
      settleContribution: async (params) => {
        settlements.push(params);
        return { recorded: true };
      },
    });

    const result = await pay.execute({ newsItemId: 'news-1', turn: 10 });
    expect(result.ok).toBe(true);
    expect(result.item.revelation).toBe('revealed');
    expect(settlements[0].amount).toBe(10);
    expect(settlements[0].newsItemId).toBe('news-1');
    expect(buildContributionBusinessKey('news-1')).toBe('contribution:news:news-1');
  });

  test('PayForNewsItem fails on insufficient funds', async () => {
    const repo = new InMemoryNewsRepo();
    await repo.save(
      createNewsItem({
        id: 'news-2',
        turn: 10,
        sourceId: 'caravan',
        categoryId: 'trade_rumor',
        title: 'Test',
        body: 'Secret',
        lifecycle: 'incoming',
        revelation: 'unpaid',
        access: { price: 10 },
      })
    );

    const pay = new PayForNewsItem(repo, {
      settleContribution: async () => ({
        recorded: false,
        reason: 'insufficient_funds',
      }),
    });

    const result = await pay.execute({ newsItemId: 'news-2', turn: 10 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient_funds');
    expect((await repo.getById('news-2')).revelation).toBe('unpaid');
  });
});
