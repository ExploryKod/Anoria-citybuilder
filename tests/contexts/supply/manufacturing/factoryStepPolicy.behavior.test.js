/**
 * Behavior tests — Supply: factory step policies
 */

import { describe, test, expect } from '@jest/globals';
import {
  shouldRunCollectStep,
  shouldRunTransformStep,
  shouldRunProduceStep,
} from '../../../../src/contexts/supply/domain/manufacturing/FactoryStepPolicy.js';
import { canProduceFromRecipe } from '../../../../src/contexts/supply/domain/manufacturing/FactoryStoragePolicy.js';
import {
  computeTransformAmount,
  effectiveFactoryStorage,
} from '../../../../src/contexts/supply/domain/manufacturing/FactoryTransformPolicy.js';
import { getFactoryCommodity } from '../../../../src/contexts/supply/domain/manufacturing/ProductRecipeCatalog.js';

describe('Supply — factory manufacturing policies', () => {
  test('collect step on first tick', () => {
    expect(
      shouldRunCollectStep({
        time: 5,
        lastCollectTurn: -1,
        lastProductionTurn: -1,
        lastTransformTurn: -1,
      })
    ).toBe(true);
  });

  test('transform step after collect', () => {
    expect(
      shouldRunTransformStep({
        time: 6,
        lastCollectTurn: 5,
        lastTransformTurn: 4,
        stepExecuted: false,
      })
    ).toBe(true);
  });

  test('produce step one turn after transform', () => {
    expect(
      shouldRunProduceStep({
        time: 8,
        lastTransformTurn: 7,
        lastProductionTurn: 6,
        stepExecuted: false,
      })
    ).toBe(true);
  });

  test('canProduceFromRecipe checks recipe inputs', () => {
    const furnitureRecipe = getFactoryCommodity('furniture')?.recipe;
    expect(canProduceFromRecipe(furnitureRecipe, { logs: 4 })).toBe(true);
    expect(canProduceFromRecipe(furnitureRecipe, { logs: 2 })).toBe(false);
  });

  test('computeTransformAmount caps by workers, storage, and stock', () => {
    expect(
      computeTransformAmount({
        allocatedWorkers: 1,
        previousStock: 10,
        currentRawStock: 10,
        currentOutputStock: 0,
        storageType: 'logs',
      })
    ).toBe(5);

    expect(
      computeTransformAmount({
        allocatedWorkers: 2,
        previousStock: 10,
        currentRawStock: 3,
        currentOutputStock: 0,
        storageType: 'logs',
      })
    ).toBe(3);
  });

  test('effectiveFactoryStorage scales capacity by worker percentage', () => {
    expect(
      effectiveFactoryStorage({
        allocatedWorkers: 1,
        currentStock: 0,
        storageType: 'wood',
      })
    ).toBeGreaterThan(0);
  });
});
