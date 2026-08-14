/**
 * HUD shell menus — gestion rail (right).
 */

function setOpenState(el, toggleBtn, open) {
  if (!el) return;
  el.hidden = !open;
  el.classList.toggle('is-open', open);
  el.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', open);
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

export function initHudShellMenus() {
  const gestionRail = document.getElementById('gestion-rail');
  const gestionBtn = document.getElementById('gestion-rail-btn');
  const gestionClose = document.getElementById('gestion-rail-close');

  function isGestionOpen() {
    return Boolean(gestionRail?.classList.contains('is-open'));
  }

  /**
   * @param {{ restoreFocus?: boolean }} [options]
   */
  function closeGestion({ restoreFocus = true } = {}) {
    setOpenState(gestionRail, gestionBtn, false);
    if (restoreFocus) {
      gestionBtn?.focus();
    }
  }

  function openGestion() {
    setOpenState(gestionRail, gestionBtn, true);
    requestAnimationFrame(() => {
      const firstAction = gestionRail?.querySelector('.gestion-rail__btn');
      if (firstAction instanceof HTMLElement) {
        firstAction.focus();
        return;
      }
      gestionClose?.focus();
    });
  }

  gestionBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isGestionOpen()) closeGestion();
    else openGestion();
  });

  gestionBtn?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (isGestionOpen()) closeGestion();
    else openGestion();
  });

  gestionClose?.addEventListener('click', (e) => {
    e.preventDefault();
    closeGestion();
  });

  // Choosing an action closes the host menu (delegation survives button rebinds).
  // Do not restore focus on the toggle — the opened panel owns focus next.
  gestionRail?.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('.gestion-rail__btn')) {
      requestAnimationFrame(() => closeGestion({ restoreFocus: false }));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isGestionOpen()) {
      closeGestion();
      e.preventDefault();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (isGestionOpen()) {
      if (!gestionRail.contains(target) && !gestionBtn.contains(target)) {
        closeGestion();
      }
    }
  });

  return {
    closeGestion,
    openGestion,
  };
}
