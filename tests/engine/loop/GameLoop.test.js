import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GameLoop } from '../../../src/engine/loop/GameLoop.js';

describe('GameLoop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('appelle onTick à intervalle fixe', async () => {
    const ticks = [];
    const loop = new GameLoop({
      intervalMs: 100,
      onTick: async (deltaMs) => {
        ticks.push(deltaMs);
      },
    });

    loop.start();
    expect(loop.isRunning).toBe(true);

    jest.advanceTimersByTime(100);
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    loop.stop();
    expect(loop.isRunning).toBe(false);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });

  test('start est idempotent', () => {
    const loop = new GameLoop({
      intervalMs: 100,
      onTick: () => {},
    });

    loop.start();
    loop.start();
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });

  test('isTickInFlight pendant un onTick async', async () => {
    let unblock;
    const gate = new Promise((resolve) => {
      unblock = resolve;
    });
    const loop = new GameLoop({
      intervalMs: 50,
      onTick: async () => {
        await gate;
      },
    });

    loop.start();
    jest.advanceTimersByTime(50);
    await Promise.resolve();
    expect(loop.isTickInFlight).toBe(true);

    jest.advanceTimersByTime(50);
    await Promise.resolve();
    expect(loop.isTickInFlight).toBe(true);

    unblock();
    await Promise.resolve();
    await Promise.resolve();
    expect(loop.isTickInFlight).toBe(false);

    loop.stop();
  });
});
