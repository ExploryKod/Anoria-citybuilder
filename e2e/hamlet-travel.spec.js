import { test, expect } from '@playwright/test';

const TRAVELS = 6;

async function scrollCarouselTo(page, hamletId) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const visible = await page.evaluate((id) => {
      const card = document.querySelector(`.hamlet-card[data-hamlet-id="${id}"]`);
      const track = document.querySelector('.hamlet-switcher__carousel .splide__track');
      if (!card || !track) return false;
      const cardBox = card.getBoundingClientRect();
      const trackBox = track.getBoundingClientRect();
      return cardBox.left >= trackBox.left && cardBox.right <= trackBox.right;
    }, hamletId);
    if (visible) return;
    await page.locator('.hamlet-switcher__carousel .splide__arrow--next').click();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`the carousel never showed the card of ${hamletId}`);
}

async function clickWhenStable(locator) {
  let previous = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const box = await locator.boundingBox();
    if (previous && box && previous.x === box.x && previous.y === box.y) break;
    previous = box;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await locator.click();
}

test('travelling between hamlets swaps the scene in place, without a reload', async ({ page }) => {
  test.setTimeout(300000);

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const consoleProblems = [];
  page.on('console', (message) => {
    consoleProblems.push(`${message.type()}: ${message.text()}`);
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Tutoriel' }).click();
  await page.waitForURL(/\/game\/[0-9a-f-]{36}\/?$/i);
  await page.waitForFunction(() => window.__scene && window.__city && window.__game && window.__renderer?.info, null, { timeout: 120000 });
  await page.locator('.tutorial-close-btn:visible').click({ timeout: 30000 });

  const hamletIds = await page.evaluate(async () => {
    const session = await import('/src/core/persistence/hamlet/hamletSession.js');
    const access = await import('/src/core/persistence/hamlet/hamletAccess.js');
    const hamlets = await session.listHamlets();
    for (const hamlet of hamlets) await access.unlockHamlet(hamlet.id);
    return hamlets.map((hamlet) => hamlet.id);
  });
  expect(hamletIds.length).toBeGreaterThan(1);

  await page.evaluate(() => { window.__sameDocumentMarker = true; });

  const samples = [];
  for (let i = 0; i < TRAVELS; i++) {
    const targetId = hamletIds[(i + 1) % hamletIds.length];
    await page.locator('#hamlet-switcher-btn').click();
    await scrollCarouselTo(page, targetId);
    await clickWhenStable(page.locator(`.hamlet-card[data-hamlet-id="${targetId}"]`));
    await expect(page.locator('#hamlet-switcher'), `travel ${i + 1}: the carousel closes`).not.toHaveClass(/mobile-build-bar--open/, { timeout: 60000 })
      .catch(async (error) => {
        const state = await page.evaluate((targetId) => ({
          path: window.location.pathname,
          activeChip: document.getElementById('game-active-hamlet')?.textContent ?? null,
          target: (() => {
            const card = document.querySelector(`.hamlet-card[data-hamlet-id="${targetId}"]`);
            if (!card) return 'card not in DOM';
            const rect = card.getBoundingClientRect();
            const under = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return {
              rect: [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value)),
              under: under ? `${under.tagName}.${String(under.className)}` : null,
              clickedInside: under ? card.contains(under) : false,
            };
          })(),
          cards: [...document.querySelectorAll('.hamlet-card')].map((card) => ({
            id: card.dataset.hamletId?.slice(0, 8),
            disabled: card.disabled,
            active: card.classList.contains('is-active'),
          })),
        }), targetId);
        throw new Error(
          `${error.message}\nstate: ${JSON.stringify(state)}\nconsole:\n${consoleProblems.slice(-25).join('\n') || '(none)'}\npage errors:\n${pageErrors.join('\n') || '(none)'}`
        );
      });
    await expect.poll(() => page.evaluate(() => window.location.pathname), { timeout: 60000 })
      .toBe(`/game/${targetId}`)
      .catch((error) => {
        throw new Error(
          `travel ${i + 1} requested ${targetId}, the URL did not follow\n${error.message}\nconsole:\n` +
          `${consoleProblems.slice(-25).join('\n') || '(none)'}\npage errors:\n${pageErrors.join('\n') || '(none)'}`
        );
      });

    const sample = await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const { geometries, textures } = window.__renderer.info.memory;
      return {
        activeHamlet: document.getElementById('game-active-hamlet')?.textContent ?? null,
        path: window.location.pathname,
        geometries,
        textures,
      };
    });

    samples.push(sample);
    console.log(
      `travel ${i + 1} to ${targetId.slice(0, 8)}: ` +
      `active="${sample.activeHamlet}" path=${sample.path} geometries=${sample.geometries} gpuTextures=${sample.textures}`
    );
    expect(sample.path, `travel ${i + 1} updated the URL`).toBe(`/game/${targetId}`);
  }

  const half = TRAVELS / 2;
  const peak = (list, key) => Math.max(...list.map((sample) => sample[key]));

  expect(await page.evaluate(() => window.__sameDocumentMarker), 'the page was not reloaded').toBe(true);
  expect(pageErrors, 'no page errors while travelling').toEqual([]);
  expect(peak(samples.slice(half), 'geometries'), 'geometries do not grow').toBeLessThanOrEqual(peak(samples.slice(0, half), 'geometries'));
  expect(peak(samples.slice(half), 'textures'), 'GPU textures do not grow').toBeLessThanOrEqual(peak(samples.slice(0, half), 'textures'));
});
