const CONSENT_COOKIE = 'cookieConsent';
const PREFS_COOKIE = 'cookieConsentPrefs';

function readCookies() {
  if (!document.cookie) return {};
  return document.cookie.split(';').reduce((acc, part) => {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) return acc;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

/** Le visiteur a déjà répondu au bandeau (accepté ou refusé). */
export function hasRecordedConsent() {
  return CONSENT_COOKIE in readCookies();
}

export function isConsentAccepted() {
  const raw = readCookies()[CONSENT_COOKIE];
  if (raw === undefined) return false;
  try {
    return JSON.parse(raw);
  } catch {
    return raw === 'true';
  }
}

/** @returns {string[] | null} */
export function getConsentPreferences() {
  const raw = readCookies()[PREFS_COOKIE];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** @param {'preferences' | 'analytics' | 'marketing'} category */
export function isPreferenceAccepted(category) {
  if (!isConsentAccepted()) return false;
  const prefs = getConsentPreferences();
  if (!prefs) return false;
  return prefs.includes(category);
}
