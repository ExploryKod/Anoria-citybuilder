import * as THREE from 'three';

export function createCamera(gameWindow) { 
    // See the doc to know what numbers here mean > https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
    const LEFT_MOUSE_BUTTON = 0;
    const MIDDLE_MOUSE_BUTTON = 1;
    const RIGHT_MOUSE_BUTTON = 2;

    const KEYBOARD_ZOOM_PLUS = '+';
    const KEYBOARD_ZOOM_MINUS = '-';

    // Camera constants for zooming in and out
    const MIN_CAMERA_RADIUS = 10;
    let MAX_CAMERA_RADIUS = 30; // Will be updated based on World platform size
    const PAN_STEP = 0.5;
    
    // Store city size to calculate max zoom
    let currentCitySize = 16;

    // Classic isometric camera settings (Pharaoh/Caesar 3 style)
    const ISOMETRIC_ELEVATION = 45; // Fixed 45° angle
    const ISOMETRIC_AZIMUTH_BASE = 225;   // Base rotation (looking from SW - standard isometric view)
    const ORTHO_CAMERA_SIZE = 20;    // Orthographic view size
    
    // Camera mode toggle
    let isIsometricMode = true; // Set to true for classic city builder style (Pharaoh/Caesar 3)
    
    // Isometric rotation offset (for rotating view east/west)
    // Start with 180° offset to show front of buildings (which are rotated 180° on Y axis)
    let isometricRotationOffset = 180; // Rotation offset in degrees (0, 90, 180, 270)

    // Vector 
    const Y_AXIS = new THREE.Vector3(0, 1, 0);

    // Create camera based on mode
    const aspect = window.innerWidth / window.innerHeight;
    let camera;
    if (isIsometricMode) {
        // OrthographicCamera for classic isometric feel (like Pharaoh/Caesar 3)
        camera = new THREE.OrthographicCamera(
            (ORTHO_CAMERA_SIZE * aspect) / -2,
            (ORTHO_CAMERA_SIZE * aspect) / 2,
            ORTHO_CAMERA_SIZE / 2,
            ORTHO_CAMERA_SIZE / -2,
            1, 1000
        );
    } else {
        // PerspectiveCamera for modern 3D feel
        camera = new THREE.PerspectiveCamera(75, aspect, 1, 1000);
    }

    camera.position.z = 0.5;
    let cameraOrigin = new THREE.Vector3();
    let cameraRadius = (MAX_CAMERA_RADIUS + MIN_CAMERA_RADIUS) / 2;
    let cameraElevation = isIsometricMode ? ISOMETRIC_ELEVATION : 20;
    let cameraAzimuth = isIsometricMode ? (ISOMETRIC_AZIMUTH_BASE + isometricRotationOffset) : 50;
    let isLeftMouseDown = false;
    let isRightMouseDown = false;
    let isMiddleMouseDown = false;
    let isZoomingMore = false;
    let isZoomingLess = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    // Dolly zoom support
    let dollyZoomEnabled = false;
    const baselineFov = camera.isPerspectiveCamera ? camera.fov : 75; // Default FOV for perspective
    let baselineRadius = (MAX_CAMERA_RADIUS + MIN_CAMERA_RADIUS) / 2;
    
    // Function to recalculate baseline radius when MAX_CAMERA_RADIUS changes
    function updateBaselineRadius() {
        baselineRadius = (MAX_CAMERA_RADIUS + MIN_CAMERA_RADIUS) / 2;
    }
    updateCameraPosition();

   

    // Bounds for camera panning (world X/Z around origin)
    let bounds = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
    
    // Callback to notify when camera changes (for updating OrbitControls, etc.)
    let onCameraChanged = null;

    function clampOrigin() {
        cameraOrigin.x = Math.max(bounds.minX, Math.min(bounds.maxX, cameraOrigin.x));
        cameraOrigin.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, cameraOrigin.z));
    }

    function onKeyBoardDown(event){
        // Toggle isometric/perspective camera mode (Pharaoh style)
        if (event.key.toLowerCase() === 'i' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
            toggleIsometric();
            return; // Don't process other keys
        }
        // Rotate view left/right with R/T keys
        if (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 't') {
            if (isIsometricMode) {
                // Isometric mode: rotate in 90° increments
                if (event.key.toLowerCase() === 'r') {
                    // Rotate left (west)
                    isometricRotationOffset = (isometricRotationOffset - 90 + 360) % 360;
                } else if (event.key.toLowerCase() === 't') {
                    // Rotate right (east)
                    isometricRotationOffset = (isometricRotationOffset + 90) % 360;
                }
                cameraAzimuth = ISOMETRIC_AZIMUTH_BASE + isometricRotationOffset;
            } else {
                // Perspective mode: rotate smoothly
                const rotationStep = 5; // Degrees per keypress
                if (event.key.toLowerCase() === 'r') {
                    // Rotate left (west)
                    cameraAzimuth = (cameraAzimuth - rotationStep + 360) % 360;
                } else if (event.key.toLowerCase() === 't') {
                    // Rotate right (east)
                    cameraAzimuth = (cameraAzimuth + rotationStep) % 360;
                }
            }
            updateCameraPosition();
            return;
        }
        // Rotate view with arrow keys + Shift
        if (event.shiftKey) {
            if (event.key === 'ArrowLeft') {
                if (isIsometricMode) {
                    // Isometric mode: rotate in 90° increments
                    isometricRotationOffset = (isometricRotationOffset - 90 + 360) % 360;
                    cameraAzimuth = ISOMETRIC_AZIMUTH_BASE + isometricRotationOffset;
                } else {
                    // Perspective mode: rotate smoothly
                    cameraAzimuth = (cameraAzimuth - 5 + 360) % 360;
                }
                updateCameraPosition();
                return;
            }
            if (event.key === 'ArrowRight') {
                if (isIsometricMode) {
                    // Isometric mode: rotate in 90° increments
                    isometricRotationOffset = (isometricRotationOffset + 90) % 360;
                    cameraAzimuth = ISOMETRIC_AZIMUTH_BASE + isometricRotationOffset;
                } else {
                    // Perspective mode: rotate smoothly
                    cameraAzimuth = (cameraAzimuth + 5) % 360;
                }
                updateCameraPosition();
                return;
            }
        }
        // Toggle dolly zoom (vertigo effect)
        if (event.key.toLowerCase() === 'v') {
            dollyZoomEnabled = !dollyZoomEnabled;
            updateCameraPosition();
        }
        // Keyboard down event
        if(event.key === KEYBOARD_ZOOM_PLUS){
            isZoomingMore = true;
            // Zooming more
        }
        if(event.key === KEYBOARD_ZOOM_MINUS){
            isZoomingLess = true;
            // Zooming less
        }

        // WASD / Arrow keys panning based on current azimuth
        const thetaAzimuth = cameraAzimuth * Math.PI / 180;
        const forward = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), thetaAzimuth);
        const left = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), thetaAzimuth);
        const key = event.key.toLowerCase();
        // Support AZERTY (ZQSD) and QWERTY (WASD)
        if (event.key === 'ArrowUp' || key === 'w' || key === 'z') {
            cameraOrigin.add(forward.clone().multiplyScalar(PAN_STEP));
            clampOrigin();
            updateCameraPosition();
        }
        if (event.key === 'ArrowDown' || key === 's') {
            cameraOrigin.add(forward.clone().multiplyScalar(-PAN_STEP));
            clampOrigin();
            updateCameraPosition();
        }
        if (event.key === 'ArrowLeft' || key === 'a' || key === 'q') {
            cameraOrigin.add(left.clone().multiplyScalar(PAN_STEP));
            clampOrigin();
            updateCameraPosition();
        }
        if (event.key === 'ArrowRight' || key === 'd') {
            cameraOrigin.add(left.clone().multiplyScalar(-PAN_STEP));
            clampOrigin();
            updateCameraPosition();
        }
    }

    function onKeyBoardUp(event){
        // Keyboard up event
        if(event.key === KEYBOARD_ZOOM_PLUS){
            isZoomingMore = false;
            // Zooming more
            cameraRadius += 0.02;
            cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, cameraRadius));
            updateCameraPosition();
        }
        if(event.key === KEYBOARD_ZOOM_MINUS){
            isZoomingLess = false;
            // Zooming less
        }
    }

    function onMouseDown(event){

        if(event.button === LEFT_MOUSE_BUTTON){
            isLeftMouseDown = true;
            // Allow Alt/Ctrl + left-drag to pan (for laptop touchpads)
            if (event.altKey || event.ctrlKey) {
                isMiddleMouseDown = true;
            }
        }
        if(event.button === RIGHT_MOUSE_BUTTON){
            isRightMouseDown = true;
        }
        if(event.button === MIDDLE_MOUSE_BUTTON){
            isMiddleMouseDown = true;
        }
    }

    function onMouseUp(event){
        // Mouse up event
        if(event.button === LEFT_MOUSE_BUTTON){
            isLeftMouseDown = false;
            // Stop the synthetic middle-drag if we started it via Alt/Ctrl
            isMiddleMouseDown = false;
        }
        if(event.button === RIGHT_MOUSE_BUTTON){
            isRightMouseDown = false;
        }
        if(event.button === MIDDLE_MOUSE_BUTTON){
            isMiddleMouseDown = false;
        }
    }

    function onMouseMove(event){

        const deltaY = event.clientY - prevMouseY;
        const deltaX = event.clientX - prevMouseX;

        // Rotation of the camera (disabled in isometric mode)
        if(isLeftMouseDown && !isIsometricMode) {
            cameraAzimuth += -((deltaX) * 0.5);
            cameraElevation += deltaY * 0.5;
            cameraElevation = Math.min(90, Math.max(-90, cameraElevation));
            updateCameraPosition();
        }

        // zoom in and out
        if(isMiddleMouseDown) { 
          const forward = new THREE.Vector3(0,0,1).applyAxisAngle(Y_AXIS, cameraAzimuth * Math.PI / 180);
          const left = new THREE.Vector3(1,0,0).applyAxisAngle(Y_AXIS, cameraAzimuth * Math.PI / 180);
          cameraOrigin.add(forward.multiplyScalar(-deltaY * 0.01));
          cameraOrigin.add(left.multiplyScalar(-deltaX * 0.01));
          clampOrigin();
          updateCameraPosition();
        }

        if(isRightMouseDown) {
            // Pan with right mouse drag (more accessible than middle for many users)
            const forward = new THREE.Vector3(0,0,1).applyAxisAngle(Y_AXIS, cameraAzimuth * Math.PI / 180);
            const left = new THREE.Vector3(1,0,0).applyAxisAngle(Y_AXIS, cameraAzimuth * Math.PI / 180);
            cameraOrigin.add(forward.multiplyScalar(-deltaY * 0.01));
            cameraOrigin.add(left.multiplyScalar(-deltaX * 0.01));
            clampOrigin();
            updateCameraPosition();
        }

        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
    }

    function onWheel(event) {
        // Touchpad friendly: pinch-to-zoom often sets ctrlKey; otherwise use wheel for panning
        if (event.ctrlKey) {
            // Prevent browser zoom - only zoom camera, not the page
            event.preventDefault();
            event.stopPropagation();
            // Zoom with pinch or ctrl+wheel
            cameraRadius += (event.deltaY > 0 ? 1 : -1) * 0.8;
            cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, cameraRadius));
            updateCameraPosition();
            return;
        }
        // Two-finger scroll to pan
        const thetaAzimuth = cameraAzimuth * Math.PI / 180;
        const forward = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), thetaAzimuth);
        const left = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), thetaAzimuth);
        // Tune the factor for comfortable trackpad panning
        const factor = 0.005;
        cameraOrigin.add(forward.multiplyScalar(-event.deltaY * factor));
        cameraOrigin.add(left.multiplyScalar(-event.deltaX * factor));
        clampOrigin();
        updateCameraPosition();
    }

    // Touch event handlers for mobile
    let touchStartDistance = 0;
    let touchStartOrigin = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isPinching = false;

    function onTouchStart(event) {
        if (event.touches.length === 1) {
            // Single touch: pan
            const touch = event.touches[0];
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            touchStartOrigin = cameraOrigin.clone();
            isLeftMouseDown = true;
        } else if (event.touches.length === 2) {
            // Two touches: pinch to zoom
            isPinching = true;
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            touchStartDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
        }
        event.preventDefault();
    }

    function onTouchMove(event) {
        if (event.touches.length === 1 && isLeftMouseDown && !isPinching) {
            // Single touch drag: pan camera
            const touch = event.touches[0];
            const deltaX = touch.clientX - lastTouchX;
            const deltaY = touch.clientY - lastTouchY;
            
            const thetaAzimuth = cameraAzimuth * Math.PI / 180;
            const forward = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), thetaAzimuth);
            const left = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), thetaAzimuth);
            
            // Pan sensitivity for touch
            const panFactor = 0.01;
            cameraOrigin.add(forward.multiplyScalar(-deltaY * panFactor));
            cameraOrigin.add(left.multiplyScalar(-deltaX * panFactor));
            clampOrigin();
            updateCameraPosition();
            
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        } else if (event.touches.length === 2 && isPinching) {
            // Two touches: pinch to zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            if (touchStartDistance > 0) {
                const zoomFactor = (touchStartDistance - currentDistance) * 0.1;
                cameraRadius += zoomFactor;
                cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, cameraRadius));
                updateCameraPosition();
                touchStartDistance = currentDistance;
            }
        }
        event.preventDefault();
    }

    function onTouchEnd(event) {
        if (event.touches.length === 0) {
            // All touches ended
            isLeftMouseDown = false;
            isPinching = false;
            touchStartDistance = 0;
            touchStartOrigin = null;
        } else if (event.touches.length === 1) {
            // One touch remaining: switch to pan mode
            isPinching = false;
            const touch = event.touches[0];
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        }
        event.preventDefault();
    }

    function updateCameraPosition(){
        // Lock angle in isometric mode (but allow rotation offset)
        if (isIsometricMode) {
            cameraElevation = ISOMETRIC_ELEVATION;
            cameraAzimuth = ISOMETRIC_AZIMUTH_BASE + isometricRotationOffset;
        }
        
        const thetaAzimuth = cameraAzimuth * Math.PI / 180;
        const phiElevation = cameraElevation * Math.PI / 180;
        camera.position.x = cameraRadius * Math.sin(thetaAzimuth) * Math.cos(phiElevation);
        camera.position.y = cameraRadius * Math.sin(phiElevation);
        camera.position.z = cameraRadius * Math.cos(thetaAzimuth) * Math.cos(phiElevation);
        camera.position.add(cameraOrigin);
        camera.lookAt(cameraOrigin);
        
        // Handle zoom differently for orthographic vs perspective
        if (isIsometricMode && camera.isOrthographicCamera) {
            // Orthographic zoom: adjust camera.zoom property
            camera.zoom = Math.max(0.3, Math.min(3, baselineRadius / cameraRadius));
        } else if (camera.isPerspectiveCamera) {
            // Perspective dolly zoom: adjust FOV inversely with radius
            if (dollyZoomEnabled) {
                const ratio = Math.max(0.25, Math.min(4, baselineRadius / cameraRadius));
                camera.fov = THREE.MathUtils.clamp(baselineFov * ratio, 20, 100);
            } else {
                camera.fov = baselineFov;
            }
        }
        
        camera.updateProjectionMatrix();
        camera.updateMatrix();
    }
    
    // Handle window resize for orthographic camera
    function handleResize() {
        const aspect = window.innerWidth / window.innerHeight;
        if (camera.isOrthographicCamera) {
            camera.left = (ORTHO_CAMERA_SIZE * aspect) / -2;
            camera.right = (ORTHO_CAMERA_SIZE * aspect) / 2;
            camera.top = ORTHO_CAMERA_SIZE / 2;
            camera.bottom = ORTHO_CAMERA_SIZE / -2;
            camera.updateProjectionMatrix();
        } else if (camera.isPerspectiveCamera) {
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
        }
    }
    window.addEventListener('resize', handleResize);
    
    // Toggle between isometric (Pharaoh style) and perspective modes
    function toggleIsometric() {
        isIsometricMode = !isIsometricMode;
        const aspect = window.innerWidth / window.innerHeight;
        
        // Create new camera of the right type
        const oldPos = camera.position.clone();
        const oldLookAt = cameraOrigin.clone();
        
        if (isIsometricMode) {
            camera = new THREE.OrthographicCamera(
                (ORTHO_CAMERA_SIZE * aspect) / -2,
                (ORTHO_CAMERA_SIZE * aspect) / 2,
                ORTHO_CAMERA_SIZE / 2,
                ORTHO_CAMERA_SIZE / -2,
                1, 1000
            );
            cameraElevation = ISOMETRIC_ELEVATION;
            cameraAzimuth = ISOMETRIC_AZIMUTH_BASE + isometricRotationOffset;
        } else {
            camera = new THREE.PerspectiveCamera(75, aspect, 1, 1000);
            cameraElevation = 20;
            cameraAzimuth = 50;
        }
        
        camera.position.copy(oldPos);
        updateCameraPosition();
        
        // Notify external systems (like OrbitControls) that camera changed
        if (onCameraChanged) {
            onCameraChanged(camera);
        }
        
        return isIsometricMode;
    }

    return {
        get camera() { return camera; },
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onKeyBoardDown,
        onKeyBoardUp,
        onWheel,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        setBounds(newBounds = {}) {
            bounds = {
                minX: newBounds.minX ?? bounds.minX,
                maxX: newBounds.maxX ?? bounds.maxX,
                minZ: newBounds.minZ ?? bounds.minZ,
                maxZ: newBounds.maxZ ?? bounds.maxZ
            };
            clampOrigin();
            updateCameraPosition();
        },
        
        // Method to center camera on city (useful when city size changes)
        centerOnCity(citySize) {
            if (typeof citySize === 'number' && citySize > 0) {
                currentCitySize = citySize;
                const cityCenter = citySize / 2;
                cameraOrigin.set(cityCenter, 0, cityCenter);
                
                // Calculate World platform size (same formula as AssetManager)
                const margin = Math.max(citySize * 0.5, 20);
                const worldPlatformSize = citySize + (margin * 2);
                
                // Calculate max camera radius to keep World platform visible
                // For orthographic camera: camera.zoom = baselineRadius / cameraRadius
                // When zoomed out (cameraRadius large), camera.zoom is small, showing more area
                // The view size = ORTHO_CAMERA_SIZE * camera.zoom
                // Minimum zoom is 0.3, so minimum view size = ORTHO_CAMERA_SIZE * 0.3 = 6 units
                
                // Calculate the diagonal of the World platform
                const worldDiagonal = worldPlatformSize * Math.sqrt(2);
                
                // Calculate the minimum zoom needed to fit the World platform (with 10% margin)
                const minZoomNeeded = (worldDiagonal / ORTHO_CAMERA_SIZE) * 1.1;
                
                // The effective minimum zoom is the larger of system minimum (0.3) and what we need
                const effectiveMinZoom = Math.max(0.3, minZoomNeeded);
                
                // Use a fixed reference baseline radius (20) for calculation to avoid circular dependency
                // This represents a typical middle value between min and max radius
                const REF_BASELINE_RADIUS = 20;
                
                // Calculate max radius: cameraRadius <= baselineRadius / effectiveMinZoom
                const maxRadiusForWorld = REF_BASELINE_RADIUS / effectiveMinZoom;
                
                // Update MAX_CAMERA_RADIUS but keep reasonable limits
                MAX_CAMERA_RADIUS = Math.max(15, Math.min(200, maxRadiusForWorld));
                
                // Recalculate baseline radius with new MAX_CAMERA_RADIUS
                updateBaselineRadius();
                
                // Debug log to verify calculation
                console.log(`[Camera] City: ${citySize}x${citySize}, World: ${worldPlatformSize.toFixed(1)}, Diagonal: ${worldDiagonal.toFixed(1)}, Min zoom needed: ${minZoomNeeded.toFixed(2)}, Max radius: ${MAX_CAMERA_RADIUS.toFixed(2)}`);
                
                // Clamp current camera radius to new limits
                cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, cameraRadius));
                
                clampOrigin();
                updateCameraPosition();
            }
        },
        // Toggle between isometric (Pharaoh style) and perspective modes
        toggleIsometric,
        // Set callback for when camera changes
        setOnCameraChanged(callback) {
            onCameraChanged = callback;
        },
        get isIsometric() { return isIsometricMode; }
    }
}