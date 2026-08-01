/**
 * One-time toast when old budget snapshots are purged.
 */

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
  const notification = document.createElement('div');
  notification.className = 'cleanup-notification';
  notification.innerHTML = `
    <div class="cleanup-content">
      <div class="cleanup-icon">🧹</div>
      <div class="cleanup-text">
        <strong>Nettoyage automatique</strong><br>
        Les états financiers de plus de 60 jours seront supprimés
        ${cleanupResult.deletedTurns ? `<br><small>Tours: ${cleanupResult.deletedTurns.join(', ')}</small>` : ''}
      </div>
      <button type="button" class="cleanup-close">×</button>
    </div>
  `;

  notification.querySelector('.cleanup-close')?.addEventListener('click', () => {
    notification.remove();
  });

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

/**
 * @param {{ deleted?: number, deletedTurns?: number[] }} [cleanupResult]
 */
export async function notifyBudgetCleanupIfNeeded(cleanupResult) {
  if (cleanupResult?.deleted > 0) {
    showCleanupNotificationOnce(cleanupResult);
  }
}
