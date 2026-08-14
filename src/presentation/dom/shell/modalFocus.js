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
    // Respect roving tabindex (inactive tabs, etc.)
    if (el.tabIndex < 0) return false;
    if (el.closest('[hidden]')) return false;
    if (el.closest('[inert]')) return false;
    // Walk ancestors: a visible child inside display:none is still not focusable.
    let node = /** @type {Element | null} */ (el);
    while (node && node instanceof Element) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      if (node === panel) break;
      node = node.parentElement;
    }
    return true;
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
 * Tab is fully trapped (capture + preventDefault) so focus cannot reach the game HUD
 * behind the overlay — EventBlocker must not swallow Tab/Escape (see EventBlocker).
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
    event.preventDefault();
    event.stopPropagation();

    if (focusables.length === 0) {
      panel.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const focused = document.activeElement;
    const currentIndex =
      focused instanceof HTMLElement ? focusables.indexOf(focused) : -1;

    if (event.shiftKey) {
      if (currentIndex <= 0) {
        last.focus();
      } else {
        focusables[currentIndex - 1].focus();
      }
      return;
    }

    if (currentIndex === -1 || currentIndex >= focusables.length - 1) {
      first.focus();
    } else {
      focusables[currentIndex + 1].focus();
    }
  }

  // Capture: run even when other document listeners exist; Tab is not blocked by EventBlocker.
  document.addEventListener('keydown', handleDocumentKeyDown, true);

  requestAnimationFrame(() => {
    if (!active) return;
    resolveInitialFocus(panel, initialFocus).focus();
  });

  return {
    release({ restoreFocus = true } = {}) {
      if (!active) return;
      active = false;
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
      panel.setAttribute('aria-hidden', 'true');
      if (restoreFocus && lastFocused && typeof lastFocused.focus === 'function') {
        // Defer: callers often clear `inert` on #game-window in the same turn after release.
        requestAnimationFrame(() => {
          try {
            if (lastFocused.isConnected) {
              lastFocused.focus();
            }
          } catch {
            /* element may have been removed */
          }
        });
      }
    },
    isActive() {
      return active;
    },
  };
}
