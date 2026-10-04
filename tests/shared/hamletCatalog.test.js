import { describe, expect, test } from '@jest/globals';
import { HAMLET_CATALOG, HAMLET_NAME_MAX_LENGTH } from '../../src/shared/hamlet-catalog/hamletCatalog.js';

describe('hamlet catalogue', () => {
  test('every hamlet name fits the player-facing length limit', () => {
    const tooLong = HAMLET_CATALOG.filter((hamlet) => hamlet.name.length > HAMLET_NAME_MAX_LENGTH).map((hamlet) => hamlet.name);
    expect(tooLong).toEqual([]);
  });
});
