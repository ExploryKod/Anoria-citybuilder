/** Liens légaux partagés — pages hors jeu uniquement. */
/** URL de la page politique de confidentialité sur le site. */
export const PRIVACY_POLICY_URL = '/privacy';

/** URL des conditions générales d'utilisation (slug anglais). */
export const TERMS_URL = '/terms';

/** URL des mentions légales. */
export const LEGAL_URL = '/legal';

/** URL des crédits (assets, licences). */
export const CREDITS_URL = '/credits';

/** Accueil avec le message d'arrivée rouvert (le texte n'existe qu'une fois, dans index.html). */
export const ABOUT_PARAM = 'a-propos';
export const ABOUT_URL = `/?${ABOUT_PARAM}`;

export const SITE_LEGAL_LINKS = [
  {
    label: 'GitHub',
    href: 'https://github.com/ExploryKod/Anoria-citybuilder',
  },
  {
    label: 'À propos',
    href: ABOUT_URL,
  },
  {
    label: 'Mentions légales',
    href: LEGAL_URL,
  },
  {
    label: 'CGU',
    href: TERMS_URL,
  },
  {
    label: 'Politique de confidentialité',
    href: PRIVACY_POLICY_URL,
  },
  {
    label: 'Crédits',
    href: CREDITS_URL,
  },
];
