// Lightweight one-shot SFX (HTML Audio). Bulldoze runs on click → autoplay policy OK.

const SOUND_URLS = Object.freeze({
  bulldoze: '/resources/sounds/lordsonny_two-debris-break-2-457507.mp3',
  placeBuilding: '/resources/sounds/freesound_community-house-building-89157.mp3',
  doorOpen: '/resources/sounds/fletchpike-door-opening-353874.mp3',
});

let enabled = true;
let volume = 0.65;

/**
 * @param {string} soundId
 */
export function playSoundEffect(soundId) {
  if (!enabled) return;
  const url = SOUND_URLS[soundId];
  if (!url) return;

  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch(() => {
    // Ignore autoplay / missing-file errors (e.g. during tests).
  });
}

export function playBulldozeSound() {
  playSoundEffect('bulldoze');
}

export function playPlaceBuildingSound() {
  playSoundEffect('placeBuilding');
}

export function playDoorOpenSound() {
  playSoundEffect('doorOpen');
}

export function setSoundEffectsEnabled(nextEnabled) {
  enabled = Boolean(nextEnabled);
}

export function setSoundEffectsVolume(nextVolume) {
  volume = Math.min(1, Math.max(0, Number(nextVolume) || 0));
}
