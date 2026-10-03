/**
 * Boucle de jeu : appelle un tick à intervalle fixe ou via requestAnimationFrame.
 * Un seul tick async à la fois — les ticks pendant un tick en cours sont ignorés.
 */
export class GameLoop {
  /** @type {number | null} */
  #intervalId = null;
  /** @type {number | null} */
  #rafId = null;
  #running = false;
  #tickInFlight = false;

  /**
   * @param {{ onTick: (deltaMs: number) => void | Promise<void>, intervalMs?: number, useAnimationFrame?: boolean }} options
   */
  constructor({ onTick, intervalMs = 1000, useAnimationFrame = false }) {
    if (typeof onTick !== 'function') {
      throw new Error('GameLoop: onTick must be a function');
    }
    this.onTick = onTick;
    this.intervalMs = intervalMs;
    this.useAnimationFrame = useAnimationFrame;
    this.#lastTickAt = null;
  }

  #lastTickAt = null;

  /** @type {number} Last time a skipped-tick warning was logged (throttled to at most 1/s). */
  #lastSkipWarnAt = 0;

  /** @param {number} intervalMs */
  setIntervalMs(intervalMs) {
    // Visible on purpose: the only way to tell, from outside, whether a speed change actually
    // reached the running loop (vs. being silently lost somewhere in the chain above it).
    console.info(`[GameLoop] interval ${this.intervalMs}ms -> ${intervalMs}ms (running: ${this.#running})`);
    this.intervalMs = intervalMs;
    if (this.#running) {
      this.stop();
      this.start();
    }
  }

  async #runTick(deltaMs) {
    if (this.#tickInFlight) {
      // A tick is still running past the next one's scheduled fire time — the interval you asked
      // for is not the interval you are getting; the simulation is compute-bound, not clock-bound.
      // Throttled to at most once/second so a genuinely overloaded tick doesn't flood the console.
      const now = performance.now();
      if (now - this.#lastSkipWarnAt > 1000) {
        this.#lastSkipWarnAt = now;
        console.warn(`[GameLoop] tick skipped: previous tick still running past ${this.intervalMs}ms interval`);
      }
      return;
    }
    this.#tickInFlight = true;
    try {
      await this.onTick(deltaMs);
    } finally {
      this.#tickInFlight = false;
    }
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#lastTickAt = performance.now();

    if (this.useAnimationFrame) {
      const frame = async (now) => {
        if (!this.#running) return;
        const deltaMs = now - this.#lastTickAt;
        this.#lastTickAt = now;
        await this.#runTick(deltaMs);
        if (!this.#running) return;
        this.#rafId = requestAnimationFrame(frame);
      };
      this.#rafId = requestAnimationFrame(frame);
      return;
    }

    this.#intervalId = setInterval(() => {
      const now = performance.now();
      const deltaMs = now - this.#lastTickAt;
      this.#lastTickAt = now;
      void this.#runTick(deltaMs);
    }, this.intervalMs);
  }

  stop() {
    this.#running = false;
    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  get isRunning() {
    return this.#running;
  }

  get isTickInFlight() {
    return this.#tickInFlight;
  }
}
