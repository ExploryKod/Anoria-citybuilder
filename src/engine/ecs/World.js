import { defineComponent } from './defineComponent.js';

/** ID réservé aux composants singleton (Time, Input, etc.) */
export const SINGLETON_ENTITY_ID = 0;

/**
 * ECS minimal : entités = IDs, composants = données, pas de logique ici.
 */
export class World {
  #nextId = 1;
  /** @type {Map<string, Map<number, unknown>>} */
  #stores = new Map();
  /** @type {Set<number>} */
  #alive = new Set();

  createEntity() {
    const id = this.#nextId++;
    this.#alive.add(id);
    return id;
  }

  /**
   * @param {number} entityId
   * @param {{ name: string }} componentType
   * @param {unknown} data
   */
  add(entityId, componentType, data) {
    this.#assertEntity(entityId);
    this.#assertComponentType(componentType);
    const store = this.#getOrCreateStore(componentType.name);
    store.set(entityId, data);
    return entityId;
  }

  /**
   * @param {{ name: string }} componentType
   * @param {unknown} data
   */
  setSingleton(componentType, data) {
    return this.add(SINGLETON_ENTITY_ID, componentType, data);
  }

  /**
   * @param {number} entityId
   * @param {{ name: string }} componentType
   */
  get(entityId, componentType) {
    this.#assertComponentType(componentType);
    return this.#stores.get(componentType.name)?.get(entityId);
  }

  /**
   * @param {{ name: string }} componentType
   */
  getSingleton(componentType) {
    return this.get(SINGLETON_ENTITY_ID, componentType);
  }

  /**
   * @param {number} entityId
   * @param {{ name: string }} componentType
   */
  has(entityId, componentType) {
    this.#assertComponentType(componentType);
    return this.#stores.get(componentType.name)?.has(entityId) ?? false;
  }

  /**
   * @param {...{ name: string }} componentTypes
   * @returns {Array<{ id: number, components: unknown[] }>}
   */
  query(...componentTypes) {
    if (componentTypes.length === 0) return [];

    const stores = componentTypes.map((type) => {
      this.#assertComponentType(type);
      return this.#stores.get(type.name) ?? new Map();
    });

    const [first, ...rest] = stores;
    const results = [];

    for (const entityId of first.keys()) {
      if (!this.#alive.has(entityId)) continue;
      if (!rest.every((store) => store.has(entityId))) continue;

      results.push({
        id: entityId,
        components: componentTypes.map((type) => this.get(entityId, type)),
      });
    }

    return results;
  }

  remove(entityId) {
    if (!this.#alive.has(entityId)) return;
    this.#alive.delete(entityId);
    for (const store of this.#stores.values()) {
      store.delete(entityId);
    }
  }

  getEntityCount() {
    return this.#alive.size;
  }

  #getOrCreateStore(name) {
    if (!this.#stores.has(name)) {
      this.#stores.set(name, new Map());
    }
    return this.#stores.get(name);
  }

  #assertEntity(entityId) {
    if (entityId !== SINGLETON_ENTITY_ID && !this.#alive.has(entityId)) {
      throw new Error(`World: unknown entity ${entityId}`);
    }
  }

  #assertComponentType(componentType) {
    if (!componentType?.name) {
      throw new Error('World: invalid component type');
    }
  }
}

export { defineComponent };
