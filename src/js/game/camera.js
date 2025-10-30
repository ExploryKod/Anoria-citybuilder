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
    const MAX_CAMERA_RADIUS = 30;
    const PAN_STEP = 0.5;

    // Vector 
    const Y_AXIS = new THREE.Vector3(2, 2, 2);

    const camera = new THREE.PerspectiveCamera(75,   window.innerWidth / window.innerHeight, 1, 1000);

    camera.position.z = 0.5;
    let cameraOrigin = new THREE.Vector3();
    let cameraRadius = (MAX_CAMERA_RADIUS + MIN_CAMERA_RADIUS) / 2;
    let cameraElevation = 20;
    let cameraAzimuth = 50;
    let isLeftMouseDown = false;
    let isRightMouseDown = false;
    let isMiddleMouseDown = false;
    let isZoomingMore = false;
    let isZoomingLess = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    // Dolly zoom support
    let dollyZoomEnabled = false;
    const baselineFov = camera.fov;
    const baselineRadius = (MAX_CAMERA_RADIUS + MIN_CAMERA_RADIUS) / 2;
    updateCameraPosition();

   

    // Bounds for camera panning (world X/Z around origin)
    let bounds = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };

    function clampOrigin() {
        cameraOrigin.x = Math.max(bounds.minX, Math.min(bounds.maxX, cameraOrigin.x));
        cameraOrigin.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, cameraOrigin.z));
    }

    function onKeyBoardDown(event){
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

        // Rotation of the camera
        if(isLeftMouseDown) {
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

    function updateCameraPosition(){
        const thetaAzimuth = cameraAzimuth * Math.PI / 180;
        const phiElevation = cameraElevation * Math.PI / 180;
        camera.position.x = cameraRadius * Math.sin(thetaAzimuth) * Math.cos(phiElevation);
        camera.position.y = cameraRadius * Math.sin(phiElevation);
        camera.position.z = cameraRadius * Math.cos(thetaAzimuth) * Math.cos(phiElevation);
        camera.position.add(cameraOrigin);
        camera.lookAt(cameraOrigin);
        // Apply dolly zoom: adjust FOV inversely with radius to keep subject scale
        if (dollyZoomEnabled) {
            const ratio = Math.max(0.25, Math.min(4, baselineRadius / cameraRadius));
            camera.fov = THREE.MathUtils.clamp(baselineFov * ratio, 20, 100);
        } else {
            camera.fov = baselineFov;
        }
        camera.updateProjectionMatrix();
        camera.updateMatrix();
    }

    return {
        camera,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onKeyBoardDown,
        onKeyBoardUp,
        onWheel,
        setBounds(newBounds = {}) {
            bounds = {
                minX: newBounds.minX ?? bounds.minX,
                maxX: newBounds.maxX ?? bounds.maxX,
                minZ: newBounds.minZ ?? bounds.minZ,
                maxZ: newBounds.maxZ ?? bounds.maxZ
            };
            clampOrigin();
            updateCameraPosition();
        }
    }
}