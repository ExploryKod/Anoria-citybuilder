import * as THREE from 'three';

const SKY_URL = '/resources/textures/skies/plain_sky.jpg';

/**
 * Manages backdrop and sky rendering
 */
export class BackdropManager {
    constructor(scene) {
        this.scene = scene;
        this.sharedBackdropMaterials = null;
    }

    /**
     * Initialize sky background
     */
    initializeSky() {
        let skyLoader = new THREE.TextureLoader();
        skyLoader.load(
            SKY_URL,
            (texture) => {
                this.scene.background = texture;
            },
            undefined,
            (error) => {
                console.warn('[BackdropManager] Sky texture failed to load:', error);
                this.scene.background = new THREE.Color(0x87CEEB);
            }
        );
    }

    /**
     * Add a distant ground plane aligned exactly with World platform
     */
    addBackdrop(citySize = 16) {
        const existingBase = this.scene.getObjectByName('infinite-ground-base');
        const existingRing = this.scene.getObjectByName('infinite-ground-ring');
        if (existingBase && existingRing) return;
        
        const margin = Math.max(citySize * 0.5, 20);
        const worldPlatformSize = citySize + (margin * 2);
        const cityCenter = citySize / 2;
        
        // Create shared backdrop materials once
        if (!this.sharedBackdropMaterials) {
            this.sharedBackdropMaterials = {
                base: new THREE.MeshLambertMaterial({
                    color: 0x6DB973,
                    fog: true
                }),
                ring: new THREE.MeshLambertMaterial({
                    color: 0x6DB973,
                    fog: true,
                    depthWrite: true
                })
            };
        }
        
        // Base ground plane - exact same size as World platform
        try {
            const baseGeo = new THREE.PlaneGeometry(worldPlatformSize, worldPlatformSize, 1, 1);
            const base = new THREE.Mesh(baseGeo, this.sharedBackdropMaterials.base);
            base.rotation.x = -Math.PI / 2;
            base.position.y = -0.02;
            base.position.x = cityCenter;
            base.position.z = cityCenter;
            base.receiveShadow = true;
            base.name = 'infinite-ground-base';
            base.renderOrder = -10;
            this.scene.add(base);
        } catch (_) {}

        // Large background plane behind the base
        try {
            const largeBackdropSize = Math.max(worldPlatformSize * 20, 5000);
            const largeGeo = new THREE.PlaneGeometry(largeBackdropSize, largeBackdropSize, 1, 1);
            const largeBackdrop = new THREE.Mesh(largeGeo, this.sharedBackdropMaterials.ring);
            largeBackdrop.rotation.x = -Math.PI / 2;
            largeBackdrop.position.y = -0.03;
            largeBackdrop.position.x = cityCenter;
            largeBackdrop.position.z = cityCenter;
            largeBackdrop.receiveShadow = true;
            largeBackdrop.name = 'infinite-ground-large';
            largeBackdrop.renderOrder = -11;
            largeBackdrop.frustumCulled = false;
            this.scene.add(largeBackdrop);
        } catch (_) {}
    }
}
