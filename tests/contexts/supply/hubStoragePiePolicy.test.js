import { buildHubStoragePieSegments } from '../../../src/contexts/supply/domain/policies/HubStoragePiePolicy.js';

/**
 * Regression: `buildHubStoragePieSegments`'s origin breakdown (the "↳ …" line under a good in the
 * hub storage pie chart) used to destructure `lotOrigin(key)`'s result as `{ producerType }`, but
 * `lotOrigin` returns `{ producerId, via }` — there is no `producerType` field, so the name was
 * always `undefined` and `buildingName(undefined)` always fell back to "…". Not specific to any one
 * good or building: every hub's origin breakdown was affected, for any lot actually attributed to a
 * producer (an unattributed-only lot never hit this path, which is why it went unnoticed).
 */
describe('buildHubStoragePieSegments — origin breakdown resolves a producer instance to its type', () => {
  test('a lot attributed to a producer instance resolves via resolveProducerType, not left undefined', () => {
    const segments = buildHubStoragePieSegments({
      lines: [
        {
          productId: 'dealDecoratedPot',
          amount: 20,
          maxCap: 500,
          emoji: '🤝',
          label: 'Export pot décoré',
          lots: { 'merchant-1': 20 },
        },
      ],
      totalCapacity: 500,
      resolveProducerType: (producerId) => (producerId === 'merchant-1' ? 'House-Blue' : null),
    });

    const [segment] = segments;
    expect(segment.parts).toHaveLength(1);
    expect(segment.parts[0].producerType).toBe('House-Blue');
    expect(segment.parts[0].amount).toBe(20);
  });

  test('a lot attributed to a producer id resolveProducerType cannot find comes back empty, not "undefined"', () => {
    const segments = buildHubStoragePieSegments({
      lines: [
        {
          productId: 'dealDecoratedPot',
          amount: 10,
          maxCap: 500,
          emoji: '🤝',
          label: 'Export pot décoré',
          lots: { 'deleted-building': 10 },
        },
      ],
      totalCapacity: 500,
      resolveProducerType: () => null,
    });

    expect(segments[0].parts[0].producerType).toBe('');
  });

  test('resolveProducerType is optional — omitting it still returns a well-formed segment', () => {
    const segments = buildHubStoragePieSegments({
      lines: [{ productId: 'dealDecoratedPot', amount: 5, maxCap: 500, emoji: '🤝', label: 'Export pot décoré', lots: { 'merchant-1': 5 } }],
      totalCapacity: 500,
    });

    expect(segments[0].parts[0].producerType).toBe('');
  });
});
