import ToastNotifier from 'js-toast-notifier';
import 'js-toast-notifier/dist/toast.css';

let toastInstance = null;

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
  getToast().info(message, options);
}

/**
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showSuccessToast(message, options = {}) {
  getToast().success(message, options);
}

/**
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showWarningToast(message, options = {}) {
  getToast().warning(message, options);
}

/**
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showErrorToast(message, options = {}) {
  getToast().error(message, options);
}

/**
 * @param {'info' | 'success' | 'warning' | 'error'} type
 * @param {string} message
 * @param {{ timeout?: number }} [options]
 */
export function showToast(type, message, options = {}) {
  switch (type) {
    case 'success':
      showSuccessToast(message, options);
      break;
    case 'warning':
      showWarningToast(message, options);
      break;
    case 'error':
      showErrorToast(message, options);
      break;
    default:
      showInfoToast(message, options);
  }
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
