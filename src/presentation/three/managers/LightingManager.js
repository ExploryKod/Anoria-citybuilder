import * as THREE from 'three';
import { renderingConfig } from '../presentationConfig.js';

/**
 * Manages scene lighting configuration
 */
export class LightingManager {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Sets up lighting and shadows for the scene
     */
    setUpLights(citySize) {
        // Remove existing lights before adding new ones
        const lightsToRemove = [];
        this.scene.traverse((child) => {
            if (child instanceof THREE.Light) {
                lightsToRemove.push(child);
            }
        });
        lightsToRemove.forEach(light => {
            this.scene.remove(light);
            if (light.shadow && light.shadow.map) {
                light.shadow.map.dispose();
            }
        });

        // Calculate dynamic light intensity based on city size
        const b = Math.log10(0.1) / Math.log10(2);
        const a = 0.03 / Math.pow(16, b);
        const c = 0.05 / Math.pow(16, b);
        let AmbientLightIntensity = a * Math.pow(citySize, b);
        let DirectionalLightIntensity = c * Math.pow(citySize, b);

        const brightnessCompensation = citySize;
        AmbientLightIntensity *= brightnessCompensation;
        DirectionalLightIntensity *= brightnessCompensation;

        // Setup ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, AmbientLightIntensity);
        this.scene.add(ambientLight);

        // Keep the original sun direction (straight down) but anchor the shadow
        // camera on the playable board center. Light at (0,1,0) left the city at
        // the frustum edge → global brightness flicker when depth contents change.
        const cx = citySize / 2;
        const cz = citySize / 2;

        const dirLight1 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight1.position.set(cx, 1, cz);
        dirLight1.target.position.set(cx, 0, cz);
        this.scene.add(dirLight1.target);
        dirLight1.castShadow = renderingConfig.shadows.enabled;

        if (dirLight1.castShadow) {
            const shadowExtent = cx + 4;
            dirLight1.shadow.camera.left = -shadowExtent;
            dirLight1.shadow.camera.right = shadowExtent;
            dirLight1.shadow.camera.top = shadowExtent;
            dirLight1.shadow.camera.bottom = -shadowExtent;
            const shadowMapSize = citySize <= 12 ? 512 : citySize <= 16 ? 1024 : 2048;
            dirLight1.shadow.mapSize.width = shadowMapSize;
            dirLight1.shadow.mapSize.height = shadowMapSize;
            dirLight1.shadow.camera.near = 0.1;
            dirLight1.shadow.camera.far = Math.max(citySize * 2, 40);
            dirLight1.shadow.normalBias = renderingConfig.shadows.normalBias ?? 0.02;
            dirLight1.shadow.bias = -0.0005;
            dirLight1.shadow.camera.updateProjectionMatrix();

            this.scene.userData.shadowLight = dirLight1;
            this.scene.userData.shadowMapBaseSize = shadowMapSize;
        }

        this.scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight2.position.set(cx, 1, cz);
        this.scene.add(dirLight2);

        const dirLight3 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight3.position.set(cx, 1, cz);
        this.scene.add(dirLight3);

        // Hemisphere light
        const hemiLightIntensity = 0.1 * brightnessCompensation;
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, hemiLightIntensity);
        hemiLight.position.set(cx, 50, cz);
        this.scene.add(hemiLight);
    }
}
