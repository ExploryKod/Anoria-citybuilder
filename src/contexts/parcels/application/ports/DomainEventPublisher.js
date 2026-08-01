/**
 * Port : publication d'événements de domaine.
 * Implémentation : contexts/parcels/infrastructure/events/
 */
export class DomainEventPublisher {
  publish(_event) {
    throw new Error('DomainEventPublisher: port not implemented');
  }

  subscribe(_eventType, _handler) {
    throw new Error('DomainEventPublisher: port not implemented');
  }
}
