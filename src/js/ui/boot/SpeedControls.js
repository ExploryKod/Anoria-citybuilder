import { displaySpeed, speedChangeIndicator, fasterButton, slowerButton } from '../nodes.js';
import { getGame } from '../../acl/appRuntime.js';

export function updateSpeedDisplay(changeDirection = '') {
  const speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
  if (displaySpeed) {
    displaySpeed.textContent = speed.toString();
  }
  if (changeDirection && speedChangeIndicator) {
    speedChangeIndicator.textContent = changeDirection;
    speedChangeIndicator.classList.add('active');
  }
}

export function initSpeedControls() {
  fasterButton.addEventListener('click', () => {
    let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
    const previousSpeed = speed;
    speed = Math.max(500, speed - 500);
    localStorage.setItem('speed', speed.toString());
    getGame()?.startInterval();
    const changeDirection = speed !== previousSpeed ? '+' : '';
    updateSpeedDisplay(changeDirection);
    if (changeDirection) {
      setTimeout(() => {
        speedChangeIndicator.classList.remove('active');
      }, 1000);
    }
  });

  slowerButton.addEventListener('click', () => {
    let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
    const previousSpeed = speed;
    speed = Math.min(20000, speed + 500);
    localStorage.setItem('speed', speed.toString());
    getGame()?.startInterval();
    const changeDirection = speed !== previousSpeed ? '−' : '';
    updateSpeedDisplay(changeDirection);
    if (changeDirection) {
      setTimeout(() => {
        speedChangeIndicator.classList.remove('active');
      }, 1000);
    }
  });
}
