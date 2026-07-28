import { SystemRunner } from '../ecs/SystemRunner.js';

/**
 * Pipeline de groupes de systèmes (simulation, render, persistence…).
 * Chaque groupe a son propre SystemRunner et un ordre d'exécution global.
 */
export class Pipeline {
  /** @type {Map<string, SystemRunner>} */
  #groups = new Map();
  /** @type {string[]} */
  #order = [];

  /**
   * @param {string} groupName
   * @returns {SystemRunner}
   */
  group(groupName) {
    if (!this.#groups.has(groupName)) {
      this.#groups.set(groupName, new SystemRunner());
      this.#order.push(groupName);
    }
    return this.#groups.get(groupName);
  }

  /**
   * @param {import('../ecs/World.js').World} world
   * @param {object} [context]
   */
  async runAll(world, context = {}) {
    for (const groupName of this.#order) {
      await this.#groups.get(groupName).run(world, context);
    }
  }

  /**
   * @param {string} groupName
   * @param {import('../ecs/World.js').World} world
   * @param {object} [context]
   */
  async runGroup(groupName, world, context = {}) {
    const runner = this.#groups.get(groupName);
    if (!runner) {
      throw new Error(`Pipeline: unknown group "${groupName}"`);
    }
    await runner.run(world, context);
  }

  getGroupNames() {
    return [...this.#order];
  }

  getSystemNames(groupName) {
    return this.#groups.get(groupName)?.names ?? [];
  }
}
