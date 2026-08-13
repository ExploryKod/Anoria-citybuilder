/**
 * Modal focus session — Tab trap, Escape, focus restore (RGAA 12.8 / 12.9, WCAG 2.4.3).
 * Shared by métier overlays (admin, bilan, carte, news, …).
 */

export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * @param {HTMLElement | null | undefined} panel
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(panel) {
  if (!panel) return [];
  return [...panel.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest('[hidden]')) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

/**
 * @param {HTMLElement} panel
 * @param {string | HTMLElement | (() => (HTMLElement | null | undefined)) | null | undefined} initialFocus
 * @returns {HTMLElement}
 */
function resolveInitialFocus(panel, initialFocus) {
  if (typeof initialFocus === 'function') {
    const el = initialFocus();
    if (el instanceof HTMLElement) return el;
  } else if (typeof initialFocus === 'string') {
    const el = panel.querySelector(initialFocus);
    if (el instanceof HTMLElement) return el;
  } else if (initialFocus instanceof HTMLElement) {
    return initialFocus;
  }

  const focusables = getFocusableElements(panel);
  return focusables[0] ?? panel;
}

/**
 * @typedef {object} ModalFocusSessionOptions
 * @property {HTMLElement} panel
 * @property {() => void} [onEscape]
 * @property {string | HTMLElement | (() => (HTMLElement | null | undefined))} [initialFocus]
 * @property {boolean} [ensureDialogAttributes=true]
 */

/**
 * @typedef {object} ModalFocusSession
 * @property {() => void} release
 * @property {() => boolean} isActive
 */

/**
 * Activate keyboard modal behaviour on a panel. Call `release()` on close.
 *
 * @param {ModalFocusSessionOptions} options
 * @returns {ModalFocusSession}
 */
export function createModalFocusSession(options) {
  const {
    panel,
    onEscape,
    initialFocus,
    ensureDialogAttributes = true,
  } = options;

  if (!(panel instanceof HTMLElement)) {
    return {
      release() {},
      isActive() {
        return false;
      },
    };
  }

  let active = true;
  const lastFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (ensureDialogAttributes) {
    if (!panel.getAttribute('role')) {
      panel.setAttribute('role', 'dialog');
    }
    if (!panel.hasAttribute('aria-modal')) {
      panel.setAttribute('aria-modal', 'true');
    }
    if (!panel.hasAttribute('tabindex')) {
      panel.setAttribute('tabindex', '-1');
    }
  }

  panel.setAttribute('aria-hidden', 'false');

  /**
   * @param {KeyboardEvent} event
   */
  function handleDocumentKeyDown(event) {
    if (!active) return;

    if (event.key === 'Escape') {
      if (typeof onEscape === 'function') {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
      }
      return;
    }

    if (event.key !== 'Tab') return;

    const focusables = getFocusableElements(panel);
    if (focusables.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const focused = document.activeElement;

    if (event.shiftKey) {
      if (focused === first || !panel.contains(focused)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (focused === last || !panel.contains(focused)) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', handleDocumentKeyDown);

  requestAnimationFrame(() => {
    if (!active) return;
    resolveInitialFocus(panel, initialFocus).focus();
  });

  return {
    release({ restoreFocus = true } = {}) {
      if (!active) return;
      active = false;
      document.removeEventListener('keydown', handleDocumentKeyDown);
      panel.setAttribute('aria-hidden', 'true');
      if (restoreFocus && lastFocused && typeof lastFocused.focus === 'function') {
        try {
          lastFocused.focus();
        } catch {
          /* element may have been removed */
        }
      }
    },
    isActive() {
      return active;
    },
  };
}
