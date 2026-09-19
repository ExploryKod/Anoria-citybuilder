/**
 * @jest-environment jsdom
 */

import { describe, expect, test } from '@jest/globals';
import {
  resolveTerrainDisplayColorCss,
  resolveTerrainDisplayColorHex,
} from '../../../src/shared/terrain-catalog/terrainDisplayColor.js';
import { KENNEY_GROUND_GRASS_COLOR } from '../../../src/shared/terrain-catalog/terrainAtmosphere.js';
import { terrainColorHexToCss } from '../../../src/shared/terrain-catalog/terrainColorBlend.js';
import { applyTerrainDisplayCssVariables } from '../../../src/shared/terrain-catalog/applyTerrainDisplayCssVariables.js';

describe('terrainDisplayColor', () => {
  test('maps legacy grass id to catalog display color', () => {
    expect(resolveTerrainDisplayColorHex('grass')).toBe(KENNEY_GROUND_GRASS_COLOR);
    expect(resolveTerrainDisplayColorCss('grass')).toBe(terrainColorHexToCss(KENNEY_GROUND_GRASS_COLOR));
  });

  test('applyTerrainDisplayCssVariables publishes tokens on :root', () => {
    const root = document.createElement('div');
    applyTerrainDisplayCssVariables(root);
    expect(root.style.getPropertyValue('--terrain-grass-color').trim()).toBe(terrainColorHexToCss(KENNEY_GROUND_GRASS_COLOR));
    expect(root.style.getPropertyValue('--terrain-sky-color').trim()).toBe('#b7d4ea');
    expect(root.style.getPropertyValue('--terrain-fog-color').trim()).toMatch(/^#/);
  });
});
