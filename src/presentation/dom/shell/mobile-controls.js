/**
 * Mobile Controls Handler
 * Provides touch-friendly alternatives to keyboard shortcuts for mobile/tablet devices.
 * Camera pan / zoom support press-and-hold for continuous movement.
 */

const HOLD_INTERVAL_MS = 45;
const CONTINUOUS_ACTIONS = new Set([
  'camera-up',
  'camera-down',
  'camera-left',
  'camera-right',
  'zoom-in',
  'zoom-out',
]);

/**
 * @param {import('../../three/camera.js').default | object} camera
 */
export function initMobileControls(camera) {
  if (!camera) {
    console.warn('[MobileControls] Camera not available');
    return;
  }

  /** @type {ReturnType<typeof setInterval> | null} */
  let holdInterval = null;

  function stopHold() {
    if (holdInterval != null) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
  }

  function simulateKeyEvent(key, options = {}) {
    const specialKeys = {
      ArrowUp: { code: 'ArrowUp', keyCode: 38 },
      ArrowDown: { code: 'ArrowDown', keyCode: 40 },
      ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
      ArrowRight: { code: 'ArrowRight', keyCode: 39 },
      '+': { code: 'Equal', keyCode: 187 },
      '-': { code: 'Minus', keyCode: 189 },
      i: { code: 'KeyI', keyCode: 73 },
      r: { code: 'KeyR', keyCode: 82 },
      t: { code: 'KeyT', keyCode: 84 },
    };

    const keyInfo = specialKeys[key];
    const keyCode = keyInfo ? keyInfo.keyCode : (key.length === 1 ? key.charCodeAt(0) : 0);
    const code = keyInfo ? keyInfo.code : `Key${key.toUpperCase()}`;

    return new KeyboardEvent('keydown', {
      key,
      code,
      keyCode,
      which: keyCode,
      shiftKey: options.shiftKey || false,
      ctrlKey: options.ctrlKey || false,
      altKey: options.altKey || false,
      bubbles: true,
      cancelable: true,
    });
  }

  function handleCameraPan(direction) {
    const keyMap = {
      up: 'ArrowDown',
      down: 'ArrowUp',
      left: 'ArrowRight',
      right: 'ArrowLeft',
    };

    const key = keyMap[direction];
    if (key && camera.onKeyBoardDown) {
      camera.onKeyBoardDown(simulateKeyEvent(key));
    }
  }

  function handleCameraRotate(direction) {
    const key = direction === 'left' ? 'r' : 't';
    if (camera.onKeyBoardDown) {
      camera.onKeyBoardDown(simulateKeyEvent(key));
    }
  }

  function handleCameraZoom(direction) {
    const key = direction === 'in' ? '+' : '-';
    if (!camera.onKeyBoardDown) return;

    camera.onKeyBoardDown(simulateKeyEvent(key));

    if (camera.onKeyBoardUp) {
      camera.onKeyBoardUp(new KeyboardEvent('keyup', {
        key,
        bubbles: true,
        cancelable: true,
      }));
    }
  }

  function handleToggleIsometric() {
    if (camera.onKeyBoardDown) {
      camera.onKeyBoardDown(simulateKeyEvent('i'));
    }
  }

  function runAction(action) {
    switch (action) {
      case 'camera-up':
        handleCameraPan('up');
        break;
      case 'camera-down':
        handleCameraPan('down');
        break;
      case 'camera-left':
        handleCameraPan('left');
        break;
      case 'camera-right':
        handleCameraPan('right');
        break;
      case 'rotate-left':
        handleCameraRotate('left');
        break;
      case 'rotate-right':
        handleCameraRotate('right');
        break;
      case 'zoom-in':
        handleCameraZoom('in');
        break;
      case 'zoom-out':
        handleCameraZoom('out');
        break;
      case 'toggle-isometric':
        handleToggleIsometric();
        break;
      default:
        console.warn(`[MobileControls] Unknown action: ${action}`);
    }
  }

  function startHold(action) {
    stopHold();
    runAction(action);
    holdInterval = setInterval(() => {
      runAction(action);
    }, HOLD_INTERVAL_MS);
  }

  function bindControlButtons(container) {
    const buttons = container.querySelectorAll('[data-action]');
    buttons.forEach((button) => {
      const action = button.getAttribute('data-action');
      if (!action) return;

      button.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        try {
          button.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }

        if (CONTINUOUS_ACTIONS.has(action)) {
          startHold(action);
        } else {
          runAction(action);
        }
      });

      const endHold = (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopHold();
        try {
          if (button.hasPointerCapture?.(e.pointerId)) {
            button.releasePointerCapture(e.pointerId);
          }
        } catch {
          // ignore
        }
      };

      button.addEventListener('pointerup', endHold);
      button.addEventListener('pointercancel', endHold);
      button.addEventListener('lostpointercapture', () => {
        stopHold();
      });

      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
  }

  const hudRotate = document.getElementById('hud-camera-rotate');
  if (hudRotate) {
    bindControlButtons(hudRotate);
  }

  if (window.innerWidth > 1024) {
    window.addEventListener('pointerup', stopHold);
    window.addEventListener('blur', stopHold);
    return;
  }

  const controls = document.getElementById('mobile-camera-controls');
  if (controls) {
    bindControlButtons(controls);
  }

  window.addEventListener('pointerup', stopHold);
  window.addEventListener('blur', stopHold);
}
