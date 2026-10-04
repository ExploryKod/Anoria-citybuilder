import { test, expect } from '@playwright/test';

const REBUILDS = 10;
const HOUSE = 'House-Blue';
const HOVER_POINTS = [
  [0.5, 0.5], [0.4, 0.5], [0.6, 0.5], [0.5, 0.4], [0.5, 0.6],
  [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7],
];

async function hoverUntilGhostShows(page) {
  const canvas = await page.evaluate(() => {
    const { left, top, width, height } = window.__renderer.domElement.getBoundingClientRect();
    return { x: left, y: top, width, height };
  });
  for (const [fx, fy] of HOVER_POINTS) {
    await page.mouse.move(canvas.x + canvas.width * fx, canvas.y + canvas.height * fy, { steps: 4 });
    const shown = await page
      .waitForFunction(() => window.__placementGhost.active, null, { timeout: 4000 })
      .then(() => true, () => false);
    if (shown) return;
  }
  const under = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return { tag: el?.tagName, id: el?.id, className: String(el?.className ?? '') };
  }, [canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.5]);
  const tool = await page.evaluate(() => window.__game.activeToolId);
  throw new Error(
    `hovering the map never showed the ghost of ${HOUSE} (activeTool=${tool}, element under the pointer=${JSON.stringify(under)})`
  );
}

test.use({ launchOptions: { slowMo: 150 } });

test('rebuilding the hamlet does not accumulate GPU resources', async ({ page }) => {
  test.setTimeout(300000);

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('link', { name: 'Tutoriel' }).click();
  await page.waitForURL(/\/game\/[0-9a-f-]{36}\/?$/i);
  await page.waitForFunction(() => window.__scene && window.__city && window.__renderer?.info, null, { timeout: 120000 });
  await page.locator('.tutorial-close-btn:visible').click({ timeout: 30000 });
  await page.locator('#toolbar-mobile-toggle').click();
  await page.locator('.mobile-build-bar__pill[data-category="houses"]').click();
  await page.locator(`.mobile-tool-btn[data-toolid="${HOUSE}"]`).first().click();

  const samples = [];
  for (let i = 0; i < REBUILDS; i++) {
    await hoverUntilGhostShows(page);
    if (i === 0) await page.screenshot({ path: `test-results/ghost-shown-${Date.now()}.png` });
    const sample = await page.evaluate(async () => {
      window.__reachOverlay.show({ roads: [{ x: 1, y: 1 }, { x: 2, y: 1 }], buildings: [] });
      window.__roadPaintPreview.show({ valid: [{ x: 3, y: 3 }], blocked: [{ x: 4, y: 3 }] });
      const ghostBefore = window.__placementGhost.active;

      await window.__scene.initialize(window.__city, { seedNature: false, hydrateEditorLayout: false });
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));

      const { geometries, textures } = window.__renderer.info.memory;
      const reachable = new Set();
      window.__threeScene.traverse((object) => {
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        for (const material of materials) {
          for (const value of Object.values(material)) {
            if (value?.isTexture) reachable.add(value);
          }
        }
      });
      return {
        ghostBefore,
        ghostAfter: window.__placementGhost.active,
        geometries,
        textures,
        reachableTextures: reachable.size,
      };
    });

    samples.push(sample);
    console.log(
      `rebuild ${i + 1}: ghostBefore=${sample.ghostBefore} ghostAfter=${sample.ghostAfter} ` +
      `geometries=${sample.geometries} gpuTextures=${sample.textures} sceneTextures=${sample.reachableTextures}`
    );
  }

  const half = REBUILDS / 2;
  const first = samples.slice(0, half);
  const second = samples.slice(half);
  const peak = (list, key) => Math.max(...list.map((sample) => sample[key]));

  expect(pageErrors, 'no page errors during rebuilds').toEqual([]);
  expect(samples.every((sample) => sample.ghostBefore), 'the ghost was shown before every rebuild').toBe(true);
  expect(peak(second, 'geometries'), 'geometries do not grow').toBeLessThanOrEqual(peak(first, 'geometries'));
  expect(peak(second, 'textures'), 'GPU textures do not grow').toBeLessThanOrEqual(peak(first, 'textures'));
});
