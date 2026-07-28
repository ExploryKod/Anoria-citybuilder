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
   */
  async run(world, context = {}) {
    for (const system of this.#systems) {
      await system.run(world, context);
    }
  }

  get names() {
    return this.#systems.map((system) => system.name);
  }
}
