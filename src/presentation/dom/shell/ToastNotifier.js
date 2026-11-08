import ToastNotifier from 'js-toast-notifier';
import 'js-toast-notifier/dist/toast.css';
import '../styles/toast-notifier.css';
import { escapeHtml } from './safeHtml.js';

let toastInstance = null;

/**
 * The library puts a toast's message into innerHTML, as markup. A toast says what the game or another player says (a pseudo, a hamlet's name): it must reach the page as
 * text. Every toast goes through here, so that no caller has to remember, and none can forget.
 * @param {unknown} message
 * @returns {string}
 */
const asText = (message) => escapeHtml(message);

function getToast() {
  if (!toastInstance) {
    toastInstance = new ToastNotifier({
      position: 'top-center',
      timeout: 4500,
      theme: 'dark',
      showCloseButton: true,
      pauseOnHover: true,
      showProgress: true,
    });
  }
  return toastInstance;
}

/**
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showInfoToast(message, options = {}) {
  return getToast().info(asText(message), options);
}

/**
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showSuccessToast(message, options = {}) {
  return getToast().success(asText(message), options);
}

/**
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showWarningToast(message, options = {}) {
  return getToast().warning(asText(message), options);
}

/**
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showErrorToast(message, options = {}) {
  return getToast().error(asText(message), options);
}

/**
 * @param {'info' | 'success' | 'warning' | 'error'} type
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<HTMLElement>} the toast's element once it is on screen (to hide it with `hideToast`)
 */
export function showToast(type, message, options = {}) {
  switch (type) {
    case 'success':
      return showSuccessToast(message, options);
    case 'warning':
      return showWarningToast(message, options);
    case 'error':
      return showErrorToast(message, options);
    default:
      return showInfoToast(message, options);
  }
}

/**
 * Takes a toast off the screen before its time (a toast that has already gone is left alone).
 * @param {Promise<HTMLElement>} shown what `showToast` returned
 */
export async function hideToast(shown) {
  const element = await shown;
  if (element?.isConnected) getToast().hide(element);
}

/**
 * @param {string} title
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showWarningNotification(title, message, options = {}) {
  showWarningToast(`${title} — ${message}`, { timeout: 5500, ...options });
}

/** @internal Tests only */
export function resetToastNotifierForTests() {
  toastInstance = null;
}
