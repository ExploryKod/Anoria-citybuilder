import { test, expect } from '@playwright/test';

test('a new game empties every store, even when the reload waits for a slow deletion', async ({ page }) => {
  test.setTimeout(300000);

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('link', { name: 'Tutoriel' }).click();
  await page.waitForURL(/\/game\/[0-9a-f-]{36}\/?$/i);
  await page.waitForFunction(() => window.__scene && window.__city && window.__renderer?.info, null, { timeout: 120000 });
  await page.locator('.tutorial-close-btn:visible').click({ timeout: 30000 });

  const oldUrl = page.url();
  await expect.poll(
    () => page.evaluate(async () => {
      const { default: db } = await import('/src/core/persistence/dexie/db.js');
      return db.journal.count();
    }),
    { timeout: 120000 }
  ).toBeGreaterThan(0);

  await page.evaluate(async () => {
    const { default: db } = await import('/src/core/persistence/dexie/db.js');
    await db.journal.add({ turn: 0, date: '1999-01-01', type: 'citizen_tax', amount: 1, description: 'LEGACY-SENTINEL' });
  });

  await page.locator('#pause-btn').click();
  await page.locator('#replay-btn').click();

  await expect.poll(() => page.url(), { timeout: 240000 }).not.toBe(oldUrl);
  await expect(page).toHaveURL(/\/game\/[0-9a-f-]{36}\/?$/i, { timeout: 240000 });
  await page.waitForFunction(() => window.__scene && window.__city, null, { timeout: 120000 });

  const stores = await page.evaluate(async () => {
    const { default: db } = await import('/src/core/persistence/dexie/db.js');
    const journal = await db.journal.toArray();
    return {
      journalRows: journal.length,
      rowsWithoutHamlet: journal.filter((row) => !row.hamletId).length,
      sentinels: journal.filter((row) => row.description === 'LEGACY-SENTINEL').length,
      hamlets: await db.hamlets.count(),
      catalogue: (await import('/src/shared/hamlet-catalog/hamletCatalog.js')).HAMLET_CATALOG.length,
    };
  });

  expect(pageErrors, 'no page errors after the new game').toEqual([]);
  expect(stores.sentinels, 'the row written before the reset is gone').toBe(0);
  expect(stores.rowsWithoutHamlet, 'every journal row names its hamlet').toBe(0);
  expect(stores.hamlets, 'the hamlets are created again, one per catalogue entry').toBe(stores.catalogue);
});
