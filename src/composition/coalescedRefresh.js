/**
 * A refresh that is asked for often and wanted at most so often: the work runs off the caller's path, never twice at once, never closer than `minIntervalMs` to the
 * end of the previous run, and always once more after the last request (so what the screen shows is the latest state, never an older one left standing).
 *
 * What it is for: the HUD of a game turn (docs/plan/performance.plan.md). Reading it takes ~200 ms (a scan of every building per figure, country and hamlet) and a
 * turn is a day, so refreshing it inside each turn made the turn two to three times longer for a figure nobody reads that often.
 *
 * @param {{ minIntervalMs: number, now?: () => number, schedule?: (run: () => void, waitMs: number) => unknown }} options
 * @returns {{ request: (work: () => Promise<void>) => void }} `request` hands over the work to run; of several requests before a run, only the latest work runs
 */
export function createCoalescedRefresh({ minIntervalMs, now = () => performance.now(), schedule = (run, waitMs) => setTimeout(run, waitMs) }) {
  if (!(minIntervalMs >= 0)) throw new Error(`[refresh] the minimum interval must be a number of milliseconds, got ${minIntervalMs}`);
  let latest = null;
  let running = false;
  let armed = false;
  let lastEndedAt = Number.NEGATIVE_INFINITY;

  async function run() {
    armed = false;
    const work = latest;
    latest = null;
    running = true;
    try {
      await work();
    } catch (error) {
      // Said loudly: a refresh that fails must not stop the game turn, nor pass unnoticed.
      console.error('[refresh] the refresh failed:', error);
    } finally {
      running = false;
      lastEndedAt = now();
      if (latest !== null) arm();
    }
  }

  function arm() {
    if (armed) return;
    armed = true;
    schedule(run, Math.max(0, lastEndedAt + minIntervalMs - now()));
  }

  return {
    request(work) {
      latest = work;
      if (!running) arm();
    },
  };
}
