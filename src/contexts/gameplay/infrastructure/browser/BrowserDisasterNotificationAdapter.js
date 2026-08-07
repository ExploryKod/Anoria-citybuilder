/**
 * Browser toast for disaster events (via js-toast-notifier).
 */

import { showErrorToast } from '../../../../presentation/dom/shell/ToastNotifier.js';

export class BrowserDisasterNotificationAdapter {
  /**
   * @param {object} event
   * @param {string} event.name
   * @param {string} event.description
   * @param {number} event.cost
   * @param {{ x: number, y: number }} house
   */
  show(event, house) {
    if (typeof document === 'undefined') {
      return;
    }

    showErrorToast(
      `⚠️ ${event.name} — ${event.description} Maison détruite à (${house.x}, ${house.y}). Coût de réparation : ${event.cost}€`,
      { timeout: 6000 }
    );
  }
}
