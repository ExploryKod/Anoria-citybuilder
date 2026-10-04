import { beforeEach } from '@jest/globals';
import { useHamletForTests } from '../src/core/persistence/hamlet/hamletSession.js';
import { TEST_HAMLET_ID } from './helpers/testHamlet.js';

beforeEach(() => {
  useHamletForTests(TEST_HAMLET_ID);
});
