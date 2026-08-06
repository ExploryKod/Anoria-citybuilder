/**
 * Complète les attributs title manquants pour afficher des tooltips natifs au survol.
 * Priorité : title existant > aria-label > texte .sr-only
 */
export function initMissingTooltips() {
  const root = document.querySelector('.game-window') ?? document;

  const candidates = root.querySelectorAll(
    'button, [role="button"], .stats-buttons, .panel-close-btn, [class*="-close-btn"]'
  );

  candidates.forEach((el) => {
    const existing = el.getAttribute('title');
    if (existing?.trim()) return;

    const aria = el.getAttribute('aria-label');
    if (aria?.trim()) {
      el.setAttribute('title', aria.trim());
      return;
    }

    const srText = el.querySelector('.sr-only')?.textContent?.trim();
    if (srText) {
      el.setAttribute('title', srText);
    }
  });
}

/** Ré-applique les tooltips quand le DOM du jeu est mis à jour dynamiquement. */
export function observeMissingTooltips() {
  const root = document.querySelector('.game-window');
  if (!root || root.dataset.tooltipsObserved === 'true') return;

  root.dataset.tooltipsObserved = 'true';
  let pending = false;

  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      initMissingTooltips();
    });
  });

  observer.observe(root, { childList: true, subtree: true });
}
