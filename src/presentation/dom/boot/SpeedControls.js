import { displaySpeed, speedChangeIndicator, fasterButton, slowerButton } from '../shell/nodes.js';
import {
  DEFAULT_TICK_MS,
  TICK_MS_MAX,
  TICK_MS_MIN,
} from '../../../shared/gameplay/SimulationDefaults.js';

export function updateSpeedDisplay(changeDirection = '') {
  const speed = parseInt(localStorage.getItem('speed'), 10) || DEFAULT_TICK_MS;
  if (displaySpeed) {
    displaySpeed.textContent = speed.toString();
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

  fasterButton?.addEventListener('click', () => {
    let speed = parseInt(localStorage.getItem('speed'), 10) || DEFAULT_TICK_MS;
    const previousSpeed = speed;
    speed = Math.max(TICK_MS_MIN, speed - 500);
    localStorage.setItem('speed', speed.toString());
    getGame()?.startInterval?.();
    const changeDirection = speed !== previousSpeed ? '+' : '';
    updateSpeedDisplay(changeDirection);
    if (changeDirection) {
      setTimeout(() => {
        speedChangeIndicator.classList.remove('active');
      }, 1000);
    }
  });

  slowerButton?.addEventListener('click', () => {
    let speed = parseInt(localStorage.getItem('speed'), 10) || DEFAULT_TICK_MS;
    const previousSpeed = speed;
    speed = Math.min(TICK_MS_MAX, speed + 500);
    localStorage.setItem('speed', speed.toString());
    getGame()?.startInterval?.();
    const changeDirection = speed !== previousSpeed ? '−' : '';
    updateSpeedDisplay(changeDirection);
    if (changeDirection) {
      setTimeout(() => {
        speedChangeIndicator.classList.remove('active');
      }, 1000);
    }
  });
}
