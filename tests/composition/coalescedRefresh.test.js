import { describe, test, expect } from '@jest/globals';
import { createCoalescedRefresh } from '../../src/composition/coalescedRefresh.js';

/** A clock and a scheduler under the test's hand: nothing runs until `advance` says so. */
function fakeTime() {
  let clock = 0;
  const queue = [];
  return {
    now: () => clock,
    schedule: (run, waitMs) => queue.push({ at: clock + waitMs, run }),
    async advance(ms) {
      clock += ms;
      for (const due of queue.filter((entry) => entry.at <= clock)) {
        queue.splice(queue.indexOf(due), 1);
        await due.run();
      }
    },
  };
}

// The HUD of a turn: asked for every turn, wanted rarely, and always left on the latest state.
describe('a coalesced refresh', () => {
  test('many requests between two runs make one run, of the latest work, and the screen ends on the latest state', async () => {
    const time = fakeTime();
    const ran = [];
    const refresh = createCoalescedRefresh({ minIntervalMs: 750, now: time.now, schedule: time.schedule });

    refresh.request(async () => ran.push('first'));
    await time.advance(0);
    expect(ran).toEqual(['first']);

    refresh.request(async () => ran.push('second'));
    refresh.request(async () => ran.push('third'));
    await time.advance(700);
    expect(ran).toEqual(['first']); // too soon after the last run
    await time.advance(100);
    expect(ran).toEqual(['first', 'third']); // one run, with the latest work
  });

  test('never two runs at once: a request during a run is run after it, not beside it', async () => {
    const time = fakeTime();
    const started = [];
    let finishFirst;
    const refresh = createCoalescedRefresh({ minIntervalMs: 0, now: time.now, schedule: time.schedule });

    refresh.request(async () => {
      started.push('first');
      await new Promise((resolve) => { finishFirst = resolve; });
    });
    const firstRun = time.advance(0); // starts the first run, which waits
    await Promise.resolve();
    expect(started).toEqual(['first']);

    refresh.request(async () => started.push('second'));
    await time.advance(10);
    expect(started).toEqual(['first']); // the first is still running: the second waits

    finishFirst();
    await firstRun;
    await time.advance(10);
    expect(started).toEqual(['first', 'second']);
  });

  test('a failing refresh is said and does not stop the next', async () => {
    const time = fakeTime();
    const ran = [];
    const refresh = createCoalescedRefresh({ minIntervalMs: 0, now: time.now, schedule: time.schedule });
    const original = console.error;
    console.error = () => {};
    try {
      refresh.request(async () => { throw new Error('boom'); });
      await time.advance(0);
      refresh.request(async () => ran.push('after'));
      await time.advance(0);
    } finally {
      console.error = original;
    }
    expect(ran).toEqual(['after']);
  });
});
