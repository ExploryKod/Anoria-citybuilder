/**
 * Mobile Controls Handler
 * Provides touch-friendly alternatives to keyboard shortcuts for mobile/tablet devices
 */

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

    // Helper function to simulate keyboard events
    function simulateKeyEvent(key, options = {}) {
        // Map special keys to proper event properties
        const specialKeys = {
            'ArrowUp': { code: 'ArrowUp', keyCode: 38 },
            'ArrowDown': { code: 'ArrowDown', keyCode: 40 },
            'ArrowLeft': { code: 'ArrowLeft', keyCode: 37 },
            'ArrowRight': { code: 'ArrowRight', keyCode: 39 },
            '+': { code: 'Equal', keyCode: 187 }, // '+' key on most keyboards
            '-': { code: 'Minus', keyCode: 189 }, // '-' key on most keyboards
            'i': { code: 'KeyI', keyCode: 73 },
            'r': { code: 'KeyR', keyCode: 82 },
            't': { code: 'KeyT', keyCode: 84 }
        };
        
        const keyInfo = specialKeys[key];
        const keyCode = keyInfo ? keyInfo.keyCode : (key.length === 1 ? key.charCodeAt(0) : 0);
        const code = keyInfo ? keyInfo.code : `Key${key.toUpperCase()}`;
        
        const event = new KeyboardEvent('keydown', {
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
        return event;
    }

    // Camera panning functions
    function handleCameraPan(direction) {
        // Use arrow keys for camera panning
        const keyMap = {
            'up': 'ArrowUp',
            'down': 'ArrowDown',
            'left': 'ArrowLeft',
            'right': 'ArrowRight'
        };
        
        const key = keyMap[direction];
        if (key && camera.onKeyBoardDown) {
            const event = simulateKeyEvent(key);
            camera.onKeyBoardDown(event);
        }
    }

    // Camera rotation functions
    function handleCameraRotate(direction) {
        const key = direction === 'left' ? 'r' : 't';
        if (camera.onKeyBoardDown) {
            const event = simulateKeyEvent(key);
            camera.onKeyBoardDown(event);
        }
    }

    // Camera zoom functions
    function handleCameraZoom(direction) {
        const key = direction === 'in' ? '+' : '-';
        if (camera.onKeyBoardDown) {
            const event = simulateKeyEvent(key);
            camera.onKeyBoardDown(event);
            
            // Also trigger keyup after a short delay to complete the zoom
            setTimeout(() => {
                if (camera.onKeyBoardUp) {
                    const upEvent = new KeyboardEvent('keyup', {
                        key: key,
                        bubbles: true,
                        cancelable: true
                    });
                    camera.onKeyBoardUp(upEvent);
                }
            }, 100);
        }
    }

    // Toggle isometric view
    function handleToggleIsometric() {
        if (camera.onKeyBoardDown) {
            const event = simulateKeyEvent('i');
            camera.onKeyBoardDown(event);
        }
    }

    // Attach event listeners to all mobile control buttons
    const buttons = controls.querySelectorAll('[data-action]');
    
    buttons.forEach(button => {
        const action = button.getAttribute('data-action');
        
        // Use touchstart for better mobile responsiveness
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
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
        }, { passive: false });

        // Also support click for hybrid devices (tablets with mouse)
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
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
        });
    });

    console.log('[MobileControls] Initialized mobile camera controls');
}

