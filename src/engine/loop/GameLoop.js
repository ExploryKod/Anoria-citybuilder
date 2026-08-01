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

  /** @param {number} intervalMs */
  setIntervalMs(intervalMs) {
    this.intervalMs = intervalMs;
    if (this.#running) {
      this.stop();
      this.start();
    }
  }

  async #runTick(deltaMs) {
    if (this.#tickInFlight) {
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
