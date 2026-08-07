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

export function initMobileControls(camera) {
    if (!camera) {
        console.warn('[MobileControls] Camera not available');
        return;
    }

    // Only initialize on mobile/tablet devices
    if (window.innerWidth > 1024) {
        return; // Desktop - no mobile controls needed
    }

    const controls = document.getElementById('mobile-camera-controls');
    if (!controls) {
        console.warn('[MobileControls] Mobile controls container not found');
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

    // Helper function to simulate keyboard events
    function simulateKeyEvent(key, options = {}) {
        // Map special keys to proper event properties
        const specialKeys = {
            'ArrowUp': { code: 'ArrowUp', keyCode: 38 },
            'ArrowDown': { code: 'ArrowDown', keyCode: 40 },
            'ArrowLeft': { code: 'ArrowLeft', keyCode: 37 },
            'ArrowRight': { code: 'ArrowRight', keyCode: 39 },
            '+': { code: 'Equal', keyCode: 187 },
            '-': { code: 'Minus', keyCode: 189 },
            'i': { code: 'KeyI', keyCode: 73 },
            'r': { code: 'KeyR', keyCode: 82 },
            't': { code: 'KeyT', keyCode: 84 }
        };

        const keyInfo = specialKeys[key];
        const keyCode = keyInfo ? keyInfo.keyCode : (key.length === 1 ? key.charCodeAt(0) : 0);
        const code = keyInfo ? keyInfo.code : `Key${key.toUpperCase()}`;

        return new KeyboardEvent('keydown', {
            key: key,
            code: code,
            keyCode: keyCode,
            which: keyCode,
            shiftKey: options.shiftKey || false,
            ctrlKey: options.ctrlKey || false,
            altKey: options.altKey || false,
            bubbles: true,
            cancelable: true
        });
    }

    function handleCameraPan(direction) {
        // D-pad labels match screen movement; keyboard pan moves the world the other way
        const keyMap = {
            'up': 'ArrowDown',
            'down': 'ArrowUp',
            'left': 'ArrowRight',
            'right': 'ArrowLeft',
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

        // Complete zoom pulse (camera uses key-down flags for +/-)
        if (camera.onKeyBoardUp) {
            camera.onKeyBoardUp(new KeyboardEvent('keyup', {
                key: key,
                bubbles: true,
                cancelable: true
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

    const buttons = controls.querySelectorAll('[data-action]');

    buttons.forEach((button) => {
        const action = button.getAttribute('data-action');
        if (!action) return;

        button.addEventListener('pointerdown', (e) => {
            // Ignore non-primary mouse buttons
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            try {
                button.setPointerCapture(e.pointerId);
            } catch {
                // ignore — some browsers reject capture on certain targets
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

        // Prevent ghost click after touch
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Safety: release hold if pointer ends outside the button
    window.addEventListener('pointerup', stopHold);
    window.addEventListener('blur', stopHold);
}
