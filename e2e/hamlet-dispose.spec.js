import { test, expect } from '@playwright/test';

const REBUILDS = 10;

test('rebuilding the hamlet does not accumulate GPU resources', async ({ page }) => {
  test.setTimeout(240000);

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('link', { name: 'Tutoriel' }).click();
  await page.waitForURL(/\/game\/[0-9a-f-]{36}\/?$/i);
  await page.waitForFunction(() => window.__scene && window.__city && window.__renderer?.info, null, { timeout: 120000 });

  const samples = [];
  for (let i = 0; i < REBUILDS; i++) {
    const memory = await page.evaluate(async () => {
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
      return { geometries, textures, reachableTextures: reachable.size };
    });
    samples.push(memory);
    console.log(`rebuild ${i + 1}: geometries=${memory.geometries} gpuTextures=${memory.textures} sceneTextures=${memory.reachableTextures}`);
  }

  // The first six rebuilds fill lazy caches (textures, shared materials); only growth after that is a leak.
  const warm = samples[5];
  const last = samples[samples.length - 1];
  expect(pageErrors, 'no page errors during rebuilds').toEqual([]);
  expect(last.geometries, 'geometries after repeated rebuilds').toBeLessThanOrEqual(Math.ceil(warm.geometries * 1.05));
  expect(last.textures, 'textures after repeated rebuilds').toBeLessThanOrEqual(Math.ceil(warm.textures * 1.05));
});
