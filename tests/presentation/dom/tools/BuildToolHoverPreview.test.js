import { describe, expect, test } from '@jest/globals';
import { BUILDING_ASSETS } from '../../../../src/presentation/three/assets/buildingAssets.js';
import { getDirectToolForCategory } from '../../../../src/presentation/three/assets/buildingCategories.js';
import { MOBILE_TOOLBAR_CATEGORIES } from '../../../../src/presentation/dom/tools/mobileToolbarCategories.js';
import {
  resolveToolPreviewProfile,
  resolveToolPreviewUrl,
} from '../../../../src/presentation/dom/tools/BuildToolHoverPreview.js';

describe('BuildToolHoverPreview', () => {
  test('resolves Kenney city kit preview URLs', () => {
    // Library is the reassigned, buttoned id for Kenney-Commercial-building-d
    // — the raw Kenney entry itself stays button: null (fallback only), so
    // it has no preview of its own anymore. (Market-Stall used to be this
    // example, but Market-Stall-Red is now the one placeable market — see
    // buildingAssets.js, user request 2026-09-08 — so Market-Stall's own
    // button, and the raw Kenney-Commercial-building-a it borrows from, are
    // both null now too.)
    const url = resolveToolPreviewUrl('Library');
    expect(url).toMatch(/kenney_city-kit-commercial/);
    expect(url).toMatch(/building-d\.png$/);
  });

  test('uses enlarged upscale profile for city-kit sprites', () => {
    expect(resolveToolPreviewProfile('Kenney-Suburban-building-type-a')).toBe('city-kit');
    expect(resolveToolPreviewProfile('Kenney-Commercial-building-a')).toBe('city-kit');
  });

  test('uses compact profile for high-res isometric previews', () => {
    expect(resolveToolPreviewProfile('nature:ground_grass')).toBe('high-res');
    expect(resolveToolPreviewProfile('StonePath-001')).toBe('high-res');
  });

  test('resolves editor nature preview URLs', () => {
    const url = resolveToolPreviewUrl('nature:ground_grass');
    expect(url).toBe('/resources/kenney_nature-kit/Isometric/ground_grass_NE.png');
  });

  test('returns null for tools without a PNG preview', () => {
    expect(resolveToolPreviewUrl('bulldoze')).toBeNull();
    expect(resolveToolPreviewUrl('roads')).toBeNull();
  });
});

describe('Build bar category pills — which are buttons, decided by the catalog', () => {
  test('the road pill is the road tool itself; a category with a choice has no direct tool', () => {
    expect(getDirectToolForCategory('roads')).toBe('StonePath-001');
    expect(getDirectToolForCategory('houses')).toBeNull();
    expect(getDirectToolForCategory('farms')).toBeNull();
    expect(getDirectToolForCategory('unknown')).toBeNull();
  });

  test('every pillCategory a tool declares is a real pill, claimed by one tool only', () => {
    const pillIds = new Set(MOBILE_TOOLBAR_CATEGORIES.map((category) => category.id));
    const declared = Object.entries(BUILDING_ASSETS)
      .filter(([, asset]) => asset.button?.pillCategory)
      .map(([id, asset]) => [id, asset.button.pillCategory]);

    expect(declared.length).toBeGreaterThan(0);
    for (const [, pillCategory] of declared) {
      expect(pillIds.has(pillCategory)).toBe(true);
    }
    expect(new Set(declared.map(([, pillCategory]) => pillCategory)).size).toBe(declared.length);
  });
});
