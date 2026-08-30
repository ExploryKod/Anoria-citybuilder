/**
 * @jest-environment jsdom
 */

import { describe, expect, test } from '@jest/globals';
import {
  resolveTerrainDisplayColorCss,
  resolveTerrainDisplayColorHex,
} from '../../../src/shared/terrain-catalog/terrainDisplayColor.js';
import { applyTerrainDisplayCssVariables } from '../../../src/shared/terrain-catalog/applyTerrainDisplayCssVariables.js';

describe('terrainDisplayColor', () => {
  test('maps legacy grass id to catalog display color', () => {
    expect(resolveTerrainDisplayColorHex('grass')).toBe(0x2fe7c5);
    expect(resolveTerrainDisplayColorCss('grass')).toBe('#2fe7c5');
  });

  test('applyTerrainDisplayCssVariables publishes tokens on :root', () => {
    const root = document.createElement('div');
    applyTerrainDisplayCssVariables(root);
    expect(root.style.getPropertyValue('--terrain-grass-color').trim()).toBe('#2fe7c5');
    expect(root.style.getPropertyValue('--terrain-sky-color').trim()).toBe('#b7d4ea');
    expect(root.style.getPropertyValue('--terrain-fog-color').trim()).toMatch(/^#/);
  });
});
