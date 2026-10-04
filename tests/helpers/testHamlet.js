/** The hamlet every test runs on (made active by tests/setupActiveHamlet.js). */
export const TEST_HAMLET_ID = '5f0c8a1e-2b3d-4c5e-8f6a-7b8c9d0e1f2a';

/** @param {object} row @returns {object} the same row, filed under the test hamlet */
export function inTestHamlet(row) {
  return { hamletId: TEST_HAMLET_ID, ...row };
}
