import { SITE_LEGAL_LINKS } from './siteLegalLinks.js';

/**
 * Pied de page légal (hors /game).
 */
export function mountSiteLegalFooter() {
  if (document.querySelector('.site-legal-footer')) {
    return;
  }

  const footer = document.createElement('footer');
  footer.className = 'site-legal-footer';
  footer.setAttribute('aria-label', 'Informations légales');

  const copy = document.createElement('p');
  copy.className = 'site-legal-footer__copy';
  copy.textContent = 'Projet de Amaury Franssen — 2024 © Tous droits réservés';

  const nav = document.createElement('nav');
  nav.className = 'site-legal-footer__links';
  nav.setAttribute('aria-label', 'Liens légaux');

  SITE_LEGAL_LINKS.forEach((link, index) => {
    if (index > 0) {
      const sep = document.createElement('span');
      sep.className = 'site-legal-footer__sep';
      sep.textContent = '·';
      sep.setAttribute('aria-hidden', 'true');
      nav.appendChild(sep);
    }

    const a = document.createElement('a');
    a.className = 'site-legal-footer__link';
    a.href = link.href;
    a.textContent = link.label;
    if (/^https?:\/\//i.test(link.href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    nav.appendChild(a);
  });

  const inner = document.createElement('div');
  inner.className = 'site-legal-footer__inner';
  inner.append(copy, nav);

  footer.appendChild(inner);
  document.body.appendChild(footer);
}
