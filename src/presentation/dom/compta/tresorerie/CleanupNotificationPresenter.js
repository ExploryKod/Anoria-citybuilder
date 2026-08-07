/**
 * One-time toast when old budget snapshots are purged.
 */

import { showInfoToast } from '../../shell/ToastNotifier.js';

/**
 * @param {{ deleted?: number, deletedTurns?: number[] }} cleanupResult
 */
export function showCleanupNotificationOnce(cleanupResult) {
  if (localStorage.getItem('hasSeenCleanupNotification') === 'true') {
    return;
  }

  localStorage.setItem('hasSeenCleanupNotification', 'true');
  showCleanupNotification(cleanupResult);
}

/**
 * @param {{ deleted?: number, deletedTurns?: number[] }} cleanupResult
 */
export function showCleanupNotification(cleanupResult) {
  const turns =
    cleanupResult.deletedTurns?.length > 0
      ? ` (tours : ${cleanupResult.deletedTurns.join(', ')})`
      : '';

  showInfoToast(
    `🧹 Nettoyage automatique — les états financiers de plus de 60 jours seront supprimés${turns}`,
    { timeout: 5000 }
  );
}

/**
 * @param {{ deleted?: number, deletedTurns?: number[] }} [cleanupResult]
 */
export async function notifyBudgetCleanupIfNeeded(cleanupResult) {
  if (cleanupResult?.deleted > 0) {
    showCleanupNotificationOnce(cleanupResult);
  }
}
