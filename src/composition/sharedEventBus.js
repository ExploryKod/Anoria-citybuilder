import { InMemoryDomainEventPublisher } from '../contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';

/**
 * One process-wide domain event bus, shared across bounded contexts and
 * presentation. Reuses the generic `InMemoryDomainEventPublisher` (it has
 * zero parcels-specific behavior) instead of each context minting its own
 * instance — a publisher only a walker subscribes to is useless if the
 * context publishing the event can't reach that same instance.
 *
 * @type {InMemoryDomainEventPublisher | null}
 */
let instance = null;

export function getSharedEventBus() {
  if (!instance) {
    instance = new InMemoryDomainEventPublisher();
  }
  return instance;
}

export function resetSharedEventBusForTests() {
  instance = null;
}
