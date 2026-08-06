const STORAGE_KEY = 'anoria.playerProfiles';

const DEFAULT_PROFILES = ['Alexandros', 'Era', 'Démo'];

/** @returns {string[]} */
export function listProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((name) => typeof name === 'string' && name.trim());
      }
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_PROFILES];
}

/** @param {string} name */
export function addProfile(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    return false;
  }
  const profiles = listProfiles();
  if (!profiles.includes(trimmed)) {
    profiles.push(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      /* ignore */
    }
  }
  return true;
}
