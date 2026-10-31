import { footprintCenterOffset, projectWorldToScreen } from './placementRotation.js';

/** The screens too small to leave the bar beside the ghost: it is docked at the top instead (placement-rotation-hud.css). */
const DOCKED_QUERY = '(max-width: 1024px)';

/**
 * Floating HUD beside an anchored placement ghost (rotate + select mesh + confirm).
 *
 * @param {object} options
 * @param {() => void} [options.onRotate]
 * @param {() => void} [options.onSelectMesh] S-key equivalent, shown only when `show({ canSelectMesh })`
 * @param {() => void | Promise<void>} [options.onConfirm]
 * @param {() => void} [options.onCancel] the player gives up placing what is waiting (nothing is built)
 * @param {() => import('three').Camera | null | undefined} [options.getCamera]
 * @param {() => HTMLElement | null | undefined} [options.getCanvas]
 */
export function createPlacementRotationHud({
  onRotate,
  onSelectMesh,
  onConfirm,
  onCancel,
  getCamera = () => null,
  getCanvas = () => document.querySelector('canvas'),
} = {}) {
  const root = document.getElementById('placement-rotation-hud');
  const rotateBtn = document.getElementById('placement-rotation-turn');
  const selectBtn = document.getElementById('placement-rotation-select');
  const confirmBtn = document.getElementById('placement-rotation-confirm');
  const cancelBtn = document.getElementById('placement-rotation-cancel');

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

    // On a small screen the bar stays where the stylesheet puts it (a free place at the top): beside the building it would hide the very thing being placed
    const docked = window.matchMedia(DOCKED_QUERY).matches;
    root.classList.toggle('placement-rotation-hud--docked', docked);
    if (docked) {
      root.classList.remove('hidden');
      root.style.left = '';
      root.style.top = '';
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

  function show({ x, y, gridSize, canSelectMesh = false, canRotate = true }) {
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
    root.removeAttribute('hidden');
    root.removeAttribute('inert');
    root.setAttribute('aria-hidden', 'false');
    // A dragged plan has no turn to give: each piece fits its neighbours by itself
    rotateBtn?.classList.toggle('hidden', !canRotate);
    if (canRotate) {
      rotateBtn?.removeAttribute('tabindex');
    } else {
      rotateBtn?.setAttribute('tabindex', '-1');
    }
    // The change of shape is always there to be read as a choice that exists, greyed out when this building has only one shape; a plan has none to choose
    selectBtn?.classList.toggle('hidden', !canRotate);
    if (selectBtn) {
      selectBtn.disabled = !canSelectMesh;
      selectBtn.title = canSelectMesh ? 'Changer de forme' : 'Une seule forme pour ce bâtiment';
    }
    if (canRotate && canSelectMesh) {
      selectBtn?.removeAttribute('tabindex');
    } else {
      selectBtn?.setAttribute('tabindex', '-1');
    }
    confirmBtn?.removeAttribute('tabindex');
    cancelBtn?.removeAttribute('tabindex');
    updatePosition();
    track();
  }

  function hide() {
    stopTracking();
    isShown = false;
    anchor = null;
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('hidden', '');
      root.setAttribute('inert', '');
      root.setAttribute('aria-hidden', 'true');
      rotateBtn?.setAttribute('tabindex', '-1');
      selectBtn?.setAttribute('tabindex', '-1');
      confirmBtn?.setAttribute('tabindex', '-1');
      cancelBtn?.setAttribute('tabindex', '-1');
    }
  }

  rotateBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRotate?.();
  });

  selectBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectMesh?.();
  });

  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel?.();
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
