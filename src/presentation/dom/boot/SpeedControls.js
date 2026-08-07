import { displaySpeed, speedChangeIndicator, fasterButton, slowerButton } from '../shell/nodes.js';
import {
  DEFAULT_TICK_MS,
  DEFAULT_SPEED_LEVEL,
  SPEED_LEVEL_MAX,
  SPEED_LEVEL_MIN,
  msToSpeedLevel,
  snapTickMs,
  speedLevelToMs,
} from '../../../shared/gameplay/SimulationDefaults.js';

function readStoredTickMs() {
  const raw = parseInt(localStorage.getItem('speed'), 10);
  if (!Number.isFinite(raw)) {
    return DEFAULT_TICK_MS;
  }
  return snapTickMs(raw);
}

function readSpeedLevel() {
  return msToSpeedLevel(readStoredTickMs());
}

function writeSpeedLevel(level) {
  const ms = speedLevelToMs(level);
  localStorage.setItem('speed', String(ms));
  return ms;
}

function formatSpeedLevel(level) {
  return String(level);
}

/**
 * @param {string} [changeDirection]
 */
export function updateSpeedDisplay(changeDirection = '') {
  const level = readSpeedLevel();
  if (displaySpeed) {
    displaySpeed.textContent = formatSpeedLevel(level);
    const parent = displaySpeed.closest('.hud-speed-display');
    if (parent) {
      parent.title = `Vitesse ${level} / ${SPEED_LEVEL_MAX}`;
    }
  }
  if (changeDirection && speedChangeIndicator) {
    speedChangeIndicator.textContent = changeDirection;
    speedChangeIndicator.classList.add('active');
  }
}

/**
 * @param {{ getGame?: () => { startInterval?: () => void } | null }} [speedDeps]
 */
export function initSpeedControls(speedDeps = {}) {
  const { getGame = () => null } = speedDeps;

  // Normalize legacy ms values onto the ladder on boot
  writeSpeedLevel(readSpeedLevel());
  updateSpeedDisplay();

  fasterButton?.addEventListener('click', () => {
    const previous = readSpeedLevel();
    const next = Math.min(SPEED_LEVEL_MAX, previous + 1);
    writeSpeedLevel(next);
    getGame()?.startInterval?.();
    const changeDirection = next !== previous ? '+' : '';
    updateSpeedDisplay(changeDirection);
    if (changeDirection) {
      setTimeout(() => {
        speedChangeIndicator?.classList.remove('active');
      }, 1000);
    }
  });

  slowerButton?.addEventListener('click', () => {
    const previous = readSpeedLevel();
    const next = Math.max(SPEED_LEVEL_MIN, previous - 1);
    writeSpeedLevel(next);
    getGame()?.startInterval?.();
    const changeDirection = next !== previous ? '−' : '';
    updateSpeedDisplay(changeDirection);
    if (changeDirection) {
      setTimeout(() => {
        speedChangeIndicator?.classList.remove('active');
      }, 1000);
    }
  });
}

export { DEFAULT_SPEED_LEVEL, formatSpeedLevel, readSpeedLevel, readStoredTickMs };
