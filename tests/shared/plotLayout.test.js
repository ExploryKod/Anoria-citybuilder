import { describe, test, expect } from '@jest/globals';
import { plotFencePieces, plotMarkRefusal } from '../../src/shared/land-catalog/plotLayout.js';

describe('plots for sale are bounded by fences', () => {
  test('a lone tile is fenced on its four sides', () => {
    const fences = plotFencePieces([{ x: 3, y: 4, use: 'forest' }]);
    expect(fences).toHaveLength(4);
    expect(new Set(fences.map((fence) => fence.rotationY)).size).toBe(4);
  });

  test('two tiles of one use side by side share no fence between them', () => {
    const fences = plotFencePieces([{ x: 3, y: 4, use: 'forest' }, { x: 4, y: 4, use: 'forest' }]);
    expect(fences).toHaveLength(6);
    expect(fences.find((fence) => fence.id === 'plot-fence-3-4-east')).toBeUndefined();
    expect(fences.find((fence) => fence.id === 'plot-fence-4-4-west')).toBeUndefined();
  });

  test('an unknown use is refused by name', () => {
    expect(() => plotFencePieces([{ x: 0, y: 0, use: 'nowhere' }])).toThrow(/nowhere/);
  });
});

describe('which tiles can be put up for sale', () => {
  test('bare level ground can, a building, a plot already for sale, a tree or a slope cannot', () => {
    expect(plotMarkRefusal({})).toBeNull();
    expect(plotMarkRefusal({ relief: { flat: true, obstacle: false } })).toBeNull();
    expect(plotMarkRefusal({ buildingId: 'x' })).toBe('plot_built');
    expect(plotMarkRefusal({ plot: { use: 'forest' } })).toBe('plot_taken');
    expect(plotMarkRefusal({ relief: { flat: true, obstacle: true } })).toBe('plot_ground');
    expect(plotMarkRefusal({ relief: { flat: false, obstacle: false } })).toBe('plot_ground');
    expect(plotMarkRefusal(undefined)).toBe('out_of_bounds');
  });
});
