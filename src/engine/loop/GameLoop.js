/**
 * Boucle de jeu : appelle un tick à intervalle fixe ou via requestAnimationFrame.
 */
export class GameLoop {
  /** @type {number | null} */
  #intervalId = null;
  /** @type {number | null} */
  #rafId = null;
  #running = false;

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

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#lastTickAt = performance.now();

    if (this.useAnimationFrame) {
      const frame = async (now) => {
        if (!this.#running) return;
        const deltaMs = now - this.#lastTickAt;
        this.#lastTickAt = now;
        await this.onTick(deltaMs);
        this.#rafId = requestAnimationFrame(frame);
      };
      this.#rafId = requestAnimationFrame(frame);
      return;
    }

    this.#intervalId = setInterval(async () => {
      const now = performance.now();
      const deltaMs = now - this.#lastTickAt;
      this.#lastTickAt = now;
      await this.onTick(deltaMs);
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
}
