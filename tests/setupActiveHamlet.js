import { beforeEach } from '@jest/globals';
import { useHamletForTests } from '../src/core/persistence/hamlet/hamletSession.js';
import { TEST_HAMLET_ID } from './helpers/testHamlet.js';
import { useDaysPerMonthForTests, useEnvDaysPerMonthForTests } from '../src/config/events.js';
import { useGameTurnForTests } from '../src/composition/sessionRuntime.js';

// Tests run on a 1-day month, as they did when that was the default; a test that needs another calendar says so.
const TEST_DAYS_PER_MONTH = 1;

beforeEach(() => {
  useHamletForTests(TEST_HAMLET_ID);
  useEnvDaysPerMonthForTests(TEST_DAYS_PER_MONTH);
  useDaysPerMonthForTests(TEST_DAYS_PER_MONTH);
  useGameTurnForTests(0);
});
