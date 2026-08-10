import { footprintCenterOffset, projectWorldToScreen } from './placementRotation.js';

/**
 * Floating HUD beside an anchored placement ghost (rotate + confirm).
 */
export function createPlacementRotationHud({ onRotate, onConfirm }) {
  const root = document.getElementById('placement-rotation-hud');
  const rotateBtn = document.getElementById('placement-rotation-turn');
  const confirmBtn = document.getElementById('placement-rotation-confirm');
  const canvas = document.querySelector('canvas');

  let rafId = null;
  /** @type {{ x: number, y: number, gridSize: number } | null} */
  let anchor = null;

  function stopTracking() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function updatePosition(camera) {
    if (!root || !anchor || root.classList.contains('hidden')) {
      return;
    }

    const { x, z } = footprintCenterOffset(anchor.gridSize, anchor.x, anchor.y);
    const projected = projectWorldToScreen(camera, canvas, x, 1.2, z);

    if (!projected.visible) {
      root.classList.add('hidden');
      return;
    }

    root.classList.remove('hidden');
    const offsetX = 56;
    const offsetY = 16;
    root.style.left = `${projected.left + offsetX}px`;
    root.style.top = `${projected.top - offsetY}px`;
  }

  function track(camera) {
    stopTracking();
    const loop = () => {
      updatePosition(camera);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function show({ x, y, gridSize, camera }) {
    if (!root) return;
    anchor = { x, y, gridSize };
    root.classList.remove('hidden');
    updatePosition(camera);
    track(camera);
  }

  function hide() {
    stopTracking();
    anchor = null;
    if (root) {
      root.classList.add('hidden');
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

  return {
    show,
    hide,
    updatePosition,
  };
}
