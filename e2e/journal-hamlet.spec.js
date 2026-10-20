import { test, expect } from '@playwright/test';

test('the journal opens from Gestion, lists entries with their hamlet and shows no unknown-hamlet error', async ({ page }) => {
  test.setTimeout(300000);

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('link', { name: 'Tutoriel' }).click();
  await page.waitForURL(/\/game\/[0-9a-f-]{36}\/?$/i);
  await page.waitForFunction(() => window.__scene && window.__city && window.__renderer?.info, null, { timeout: 120000 });
  await page.locator('.tutorial-close-btn:visible').click({ timeout: 30000 });

  await expect.poll(
    () => page.evaluate(async () => {
      const { default: db } = await import('/src/core/persistence/dexie/db.js');
      return db.journal.count();
    }),
    { timeout: 120000 }
  ).toBeGreaterThan(0);

  await page.locator('#gestion-rail-btn').click();
  await page.locator('#journal-btn').click();

  const journal = page.locator('#journal-list');
  await expect.poll(() => journal.innerText(), { timeout: 60000 }).not.toContain('Chargement du journal');
  const shown = await journal.innerText();
  expect(await journal.locator('.journal-entry').count(), `journal shows:\n${shown}`).toBeGreaterThan(0);

  const text = shown;
  expect(text, 'no unknown-hamlet error in the journal').not.toContain('unknown hamlet');
  expect(text, 'no loading error in the journal').not.toContain('Erreur lors du chargement');

  const entryCount = await journal.locator('.journal-entry').count();
  const hamletChips = await journal.locator('.journal-entry-hamlet').count();
  expect(hamletChips, 'every entry shows its hamlet').toBe(entryCount);

  const options = await page.locator('#journal-hamlet-filter option').allTextContents();
  const catalogue = await page.evaluate(async () => (await import('/src/shared/hamlet-catalog/hamletCatalog.js')).HAMLET_CATALOG.map((hamlet) => hamlet.name));
  expect(options.slice(1), 'the filter lists every hamlet of the catalogue').toEqual(catalogue);

  expect(pageErrors, 'no page errors while opening the journal').toEqual([]);
});
