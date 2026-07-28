/**
 * Branchement ECS — createGameRuntime (comportement du tick simulation)
 */

import { describe, test, expect } from '@jest/globals';
import { createGameRuntime } from '../../src/composition/createGameRuntime.js';

function fakeParcels() {
  let calls = 0;
  return {
    calls: () => calls,
    recalculateAllRoadAccess: {
      execute: async () => {
        calls += 1;
        return { processed: 0, updated: 0 };
      },
    },
  };
}

describe('createGameRuntime', () => {
  test('enregistre le system parcels.roadAccess dans le groupe simulation', () => {
    const runtime = createGameRuntime({ parcels: fakeParcels() });

    expect(runtime.pipeline.getGroupNames()).toEqual(['simulation']);
    expect(runtime.pipeline.getSystemNames('simulation')).toEqual([
      'parcels.roadAccess',
    ]);
    expect(runtime.world).toBeDefined();
  });

  test('runSimulation délègue au use case Parcels (filet road access)', async () => {
    const parcels = fakeParcels();
    const runtime = createGameRuntime({ parcels });

    await runtime.runSimulation({ time: 3 });

    expect(parcels.calls()).toBe(1);
  });

  test('refuse un contexte parcels invalide', () => {
    expect(() => createGameRuntime({})).toThrow(/parcels/);
  });
});
