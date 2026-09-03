import { describe, expect, test } from '@jest/globals';
import { InMemoryDomainEventPublisher } from '../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { findRoadPathBetweenBuildings } from '../../../src/shared/gameplay/roadNetworkPathfinder.js';

/**
 * Proves the trigger-scan shape works end to end with hardcoded buildings:
 * a domain event carrying an origin/destination building is published, a
 * subscriber (the future "trigger scan") reacts by running the generic
 * pathfinder — no walker/goods/effect specifics involved yet.
 *
 * Reuses the existing `InMemoryDomainEventPublisher` (contexts/parcels) as
 * the generic pub/sub — it already knows nothing about parcels-specific
 * concerns, so it's safe to publish an unrelated event type through it.
 */
describe('walker trigger scan (proof of concept)', () => {
  test('a published event drives the pathfinder between two fixed buildings', () => {
    const rows = [
      '.....',
      'BRRRB',
      '.....',
    ];
    const isRoadTile = (x, y) => rows[y]?.[x] === 'R';

    const events = new InMemoryDomainEventPublisher();
    let computedPath = null;

    events.subscribe('walker.pathRequested', (event) => {
      computedPath = findRoadPathBetweenBuildings({
        start: event.origin,
        end: event.destination,
        isRoadTile,
      });
    });

    events.publish({
      type: 'walker.pathRequested',
      origin: { x: 0, y: 1 },
      destination: { x: 4, y: 1 },
    });

    expect(computedPath).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ]);
  });
});
