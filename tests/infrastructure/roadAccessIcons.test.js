import { describe, test, expect, beforeEach } from '@jest/globals';
import { setupRoadAccessIcons, clearRoadAccessIconViews } from '../../src/infrastructure/roadAccessIcons.js';
import { InMemoryDomainEventPublisher } from '../../src/infrastructure/events/InMemoryDomainEventPublisher.js';
import { createRoadAccessChanged } from '../../src/contexts/parcels/domain/events/RoadAccessChanged.js';

describe('roadAccessIcons', () => {
  beforeEach(() => {
    clearRoadAccessIconViews();
  });

  test('met à jour l\'icône via le bus quand roadCount change', async () => {
    const events = new InMemoryDomainEventPublisher();
    const mesh = { name: 'House-Blue' };
    const calls = [];
    const assetManager = { setStatusSprite: (...args) => calls.push(args) };
    const textures = { 'no-roads': 'tex-no-road' };

    const syncRoadAccess = setupRoadAccessIcons(
      { eventPublisher: events, recalculateRoadAccessForBuilding: { execute: async () => ({ updated: false, roadAccess: { hasAccess: true, roadCount: 1 } }) } },
      { assetManager, textures }
    );

    await syncRoadAccess({
      buildingId: 'House-Blue-1-1',
      mesh,
      position: { x: 0, y: 1, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });

    events.publish(
      createRoadAccessChanged({
        buildingId: 'House-Blue-1-1',
        previousRoadCount: 0,
        newRoadAccess: { roadCount: 2, hasAccess: true },
      })
    );

    expect(calls).toHaveLength(2); // fallback sync + événement
    expect(calls[1][5]).toBe(false); // hasAccess → pas d'icône no-road
  });
});
