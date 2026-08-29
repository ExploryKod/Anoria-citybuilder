/**
 * One-shot Dexie v5 reconciliation — unlock is explicit, not tied to natureSeeded.
 */

/**
 * @param {import('dexie').Transaction} tx
 * @returns {Promise<void>}
 */
export async function reconcileHamletUnlockFlags(tx) {
  const hamletsAllCheat = await tx.table('cheatCodes').get('HamletsAll');
  const keepAllUnlocked = Boolean(hamletsAllCheat?.activationCount);

  await tx.table('hamlets').toCollection().modify((row) => {
    if (row.id === 'eraanurbs') {
      row.unlocked = true;
      return;
    }
    if (!keepAllUnlocked) {
      row.unlocked = false;
    }
  });
}
