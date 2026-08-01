import * as THREE from 'three';
import config from '../../../js/game/config.js';

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

        // Setup THREE directional lights
        const dirLight1 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight1.position.set(0, 1, 0);
        dirLight1.castShadow = config.rendering.shadows.enabled;

        if (dirLight1.castShadow) {
            dirLight1.shadow.camera.left = -10;
            dirLight1.shadow.camera.right = 10;
            dirLight1.shadow.camera.top = 0;
            dirLight1.shadow.camera.bottom = -10;
            const shadowMapSize = citySize <= 12 ? 256 : citySize <= 16 ? 512 : 1024;
            dirLight1.shadow.mapSize.width = shadowMapSize;
            dirLight1.shadow.mapSize.height = shadowMapSize;
            dirLight1.shadow.camera.near = 0.5;
            dirLight1.shadow.camera.far = 50;
            
            this.scene.userData.shadowLight = dirLight1;
            this.scene.userData.shadowMapBaseSize = shadowMapSize;
        }

        this.scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight2.position.set(0, 1, 0);
        this.scene.add(dirLight2);

        const dirLight3 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight3.position.set(0, 1, 0);
        this.scene.add(dirLight3);

        // Hemisphere light
        const hemiLightIntensity = 0.1 * brightnessCompensation;
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, hemiLightIntensity);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);
    }
}
