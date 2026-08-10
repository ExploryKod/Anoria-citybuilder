import { footprintCenterOffset, projectWorldToScreen } from './placementRotation.js';

/**
 * Floating HUD beside an anchored placement ghost (rotate + confirm).
 *
 * @param {object} options
 * @param {() => void} [options.onRotate]
 * @param {() => void | Promise<void>} [options.onConfirm]
 * @param {() => import('three').Camera | null | undefined} [options.getCamera]
 * @param {() => HTMLElement | null | undefined} [options.getCanvas]
 */
export function createPlacementRotationHud({
  onRotate,
  onConfirm,
  getCamera = () => null,
  getCanvas = () => document.querySelector('canvas'),
} = {}) {
  const root = document.getElementById('placement-rotation-hud');
  const rotateBtn = document.getElementById('placement-rotation-turn');
  const confirmBtn = document.getElementById('placement-rotation-confirm');

  let rafId = null;
  let isShown = false;
  /** @type {{ x: number, y: number, gridSize: number } | null} */
  let anchor = null;

  function stopTracking() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function placeFallback() {
    if (!root) return;
    root.style.left = '50%';
    root.style.top = 'calc(50% - 48px)';
  }

  function updatePosition() {
    if (!root || !isShown || !anchor) {
      return;
    }

    const camera = getCamera();
    const canvas = getCanvas();
    const { x, z } = footprintCenterOffset(anchor.gridSize, anchor.x, anchor.y);
    const projected = projectWorldToScreen(camera, canvas, x, 1.35, z);

    root.classList.remove('hidden');

    if (!camera || !canvas || !projected.visible) {
      placeFallback();
      return;
    }

    const offsetX = 56;
    const offsetY = 16;
    root.style.left = `${projected.left + offsetX}px`;
    root.style.top = `${projected.top - offsetY}px`;
  }

  function track() {
    stopTracking();
    const loop = () => {
      updatePosition();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function show({ x, y, gridSize }) {
    if (!root) {
      console.warn('[placementRotationHud] #placement-rotation-hud missing from DOM');
      return;
    }
    // Escape game-window stacking contexts so position:fixed stays viewport-relative.
    if (root.parentElement !== document.body) {
      document.body.appendChild(root);
    }
    anchor = { x, y, gridSize };
    isShown = true;
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    updatePosition();
    track();
  }

  function hide() {
    stopTracking();
    isShown = false;
    anchor = null;
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
  }

  rotateBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRotate?.();
  });

  confirmBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onConfirm?.();
  });

  // Touch taps must not bubble to the canvas / document touch handlers.
  root?.addEventListener('pointerdown', (e) => e.stopPropagation());
  root?.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

  return {
    show,
    hide,
    updatePosition,
  };
}
