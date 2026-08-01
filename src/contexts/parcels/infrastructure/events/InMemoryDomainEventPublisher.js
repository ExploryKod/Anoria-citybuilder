import { DomainEventPublisher } from '../../application/ports/DomainEventPublisher.js';

/**
 * Adapter : bus d'événements en mémoire (tests + dev).
 */
export class InMemoryDomainEventPublisher extends DomainEventPublisher {
  /** @type {Map<string, Set<Function>>} */
  #handlers = new Map();
  /** @type {Array<object>} */
  #history = [];

  subscribe(eventType, handler) {
    if (!this.#handlers.has(eventType)) {
      this.#handlers.set(eventType, new Set());
    }
    this.#handlers.get(eventType).add(handler);
    return () => this.#handlers.get(eventType)?.delete(handler);
  }

  publish(event) {
    this.#history.push(event);
    const handlers = this.#handlers.get(event.type);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(event);
    }
  }

  getHistory(eventType) {
    if (!eventType) return [...this.#history];
    return this.#history.filter((event) => event.type === eventType);
  }

  clear() {
    this.#handlers.clear();
    this.#history = [];
  }
}
