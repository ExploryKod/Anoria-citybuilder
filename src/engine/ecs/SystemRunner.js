/**
 * Exécute des systèmes dans l'ordre d'enregistrement.
 * Un système = (world, context) => void | Promise<void>
 */
export class SystemRunner {
  /** @type {Array<{ name: string, run: Function }>} */
  #systems = [];

  /**
   * @param {string} name
   * @param {Function} fn
   */
  register(name, fn) {
    if (typeof fn !== 'function') {
      throw new Error(`SystemRunner: "${name}" must be a function`);
    }
    this.#systems.push({ name, run: fn });
    return this;
  }

  /**
   * @param {import('./World.js').World} world
   * @param {object} [context]
   * @returns {Promise<Array<{ name: string, ms: number }>>} the milliseconds each system took, in the order they ran (a measurement, nothing reads it to decide)
   */
  async run(world, context = {}) {
    const timings = [];
    for (const system of this.#systems) {
      const startedAt = performance.now();
      await system.run(world, context);
      timings.push({ name: system.name, ms: performance.now() - startedAt });
    }
    return timings;
  }

  get names() {
    return this.#systems.map((system) => system.name);
  }
}
