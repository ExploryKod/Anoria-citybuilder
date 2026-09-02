import { describe, expect, test } from '@jest/globals';
import {
  resolveToolPreviewProfile,
  resolveToolPreviewUrl,
} from '../../../../src/presentation/dom/tools/BuildToolHoverPreview.js';

describe('BuildToolHoverPreview', () => {
  test('resolves Kenney city kit preview URLs', () => {
    const url = resolveToolPreviewUrl('Kenney-Commercial-building-a');
    expect(url).toMatch(/kenney_city-kit-commercial/);
    expect(url).toMatch(/building-a\.png$/);
  });

  test('uses enlarged upscale profile for city-kit sprites', () => {
    expect(resolveToolPreviewProfile('Kenney-Suburban-building-type-a')).toBe('city-kit');
    expect(resolveToolPreviewProfile('Kenney-Commercial-building-a')).toBe('city-kit');
  });

  test('uses compact profile for high-res isometric previews', () => {
    expect(resolveToolPreviewProfile('nature:ground_grass')).toBe('high-res');
    expect(resolveToolPreviewProfile('Windmill-001')).toBe('high-res');
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
