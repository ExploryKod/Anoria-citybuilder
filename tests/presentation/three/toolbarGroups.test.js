/**
 * The build-bar pills: a workplace is listed under the social class whose houses staff it, derived from the catalog (the
 * skill it requires, granted by a class) — never from a hand-typed group, so a skill moved to another class moves its
 * buildings with it, and a building cannot be listed twice or nowhere.
 */
import { describe, test, expect } from '@jest/globals';
import { BUILDING_ASSETS } from '../../../src/presentation/three/assets/buildingAssets.js';
import { toolbarGroupOf } from '../../../src/presentation/three/assets/buildingCategories.js';

const tools = Object.entries(BUILDING_ASSETS).filter(([, entry]) => entry.button).map(([id]) => id);

describe('toolbarGroupOf — the pill a building is listed under', () => {
  test('every tool has exactly one pill, and none throws', () => {
    expect(tools.length).toBeGreaterThan(0);
    for (const id of tools) expect(() => toolbarGroupOf(id)).not.toThrow();
  });

  test('a workplace is listed under the social class that staffs it', () => {
    expect(toolbarGroupOf('Farm-Wheat')).toBe('artisans');
    expect(toolbarGroupOf('Factory-Furniture')).toBe('artisans');
    expect(toolbarGroupOf('CoalPlant')).toBe('artisans');
    expect(toolbarGroupOf('PetrolPlant')).toBe('artisans');
    expect(toolbarGroupOf('Market-Stall-Red')).toBe('merchants');
    expect(toolbarGroupOf('Warehouse')).toBe('merchants');
    expect(toolbarGroupOf('TradeWarehouse')).toBe('merchants');
    expect(toolbarGroupOf('Pub')).toBe('merchants');
    expect(toolbarGroupOf('WaterTank')).toBe('scholars');
    expect(toolbarGroupOf('Doctor')).toBe('scholars');
    expect(toolbarGroupOf('FireStation')).toBe('scholars');
    expect(toolbarGroupOf('PoliceStation')).toBe('scholars');
  });

  test('the houses of the three classes share the one houses pill, and the road its own', () => {
    for (const id of ['House-Red', 'House-Blue', 'House-Purple']) expect(toolbarGroupOf(id)).toBe('houses');
    expect(toolbarGroupOf('StonePath-001')).toBe('infrastructure');
  });

  test('each of the three class pills has buildings to list', () => {
    const groups = new Set(tools.map(toolbarGroupOf));
    for (const group of ['houses', 'artisans', 'merchants', 'scholars']) expect(groups.has(group)).toBe(true);
  });
});
