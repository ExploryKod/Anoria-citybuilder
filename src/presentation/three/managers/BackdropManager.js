import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SKY_DOME_URL = '/resources/lowpoly/sky-day-dome.glb';
/** Soft horizon fallback behind the dome (open hemisphere base / load failure). */
const SKY_FALLBACK_COLOR = 0xb7d4ea;
/** Target world radius so the camera (far ≈ 1000) stays inside the dome. */
const SKY_TARGET_RADIUS = 700;

/**
 * Manages backdrop and sky rendering (lowpoly day dome + distant ground).
 */
export class BackdropManager {
    constructor(scene) {
        this.scene = scene;
        this.sharedBackdropMaterials = null;
        /** @type {THREE.Object3D | null} */
        this.skyDome = null;
        /** @type {THREE.Object3D | null} */
        this._skyDomeTemplate = null;
        /** Local Y of the dome bbox center after scale (camera sits near this point). */
        this._skyCenterOffsetY = 0;
        /** @type {Promise<THREE.Object3D | null> | null} */
        this._skyLoadPromise = null;
    }

    /**
     * Load (once) and attach the day sky dome. Re-callable after scene.clear().
     * @returns {Promise<void>}
     */
    async initializeSky() {
        this.scene.background = new THREE.Color(SKY_FALLBACK_COLOR);

        const existing = this.scene.getObjectByName('sky-dome');
        if (existing) {
            this.skyDome = existing;
            return;
        }

        try {
            const root = await this.#ensureSkyTemplate();
            if (!root) {
                console.warn('[BackdropManager] Sky dome unavailable, using solid background');
                return;
            }

            const dome = root.clone(true);
            this.#configureSkyDome(dome);
            this.skyDome = dome;
            this.scene.add(dome);
        } catch (error) {
            console.warn('[BackdropManager] Sky dome failed to load:', error);
            this.skyDome = null;
        }
    }

    /**
     * Keep the dome centred on the active camera (iso + perspective).
     * @param {THREE.Camera | null | undefined} camera
     */
    syncSkyToCamera(camera) {
        if (!this.skyDome || !camera) return;
        this.skyDome.position.copy(camera.position);
        this.skyDome.position.y -= this._skyCenterOffsetY;
    }

    /**
     * Drop the live instance (e.g. before scene.clear). Keeps the cached template.
     */
    detachSky() {
        if (this.skyDome?.parent) {
            this.skyDome.parent.remove(this.skyDome);
        }
        this.skyDome = null;
    }

    /**
     * @returns {Promise<THREE.Object3D | null>}
     */
    async #ensureSkyTemplate() {
        if (this._skyDomeTemplate) return this._skyDomeTemplate;
        if (this._skyLoadPromise) return this._skyLoadPromise;

        this._skyLoadPromise = new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.load(
                SKY_DOME_URL,
                (gltf) => {
                    const root = gltf.scene || gltf.scenes?.[0] || null;
                    if (!root) {
                        resolve(null);
                        return;
                    }
                    root.updateMatrixWorld(true);
                    this._skyDomeTemplate = root;
                    resolve(root);
                },
                undefined,
                (error) => {
                    console.warn('[BackdropManager] GLTF load error:', error);
                    resolve(null);
                }
            );
        });

        return this._skyLoadPromise;
    }

    /**
     * @param {THREE.Object3D} dome
     */
    #configureSkyDome(dome) {
        dome.name = 'sky-dome';
        dome.frustumCulled = false;
        dome.renderOrder = -1000;
        dome.matrixAutoUpdate = true;

        dome.traverse((child) => {
            if (!child.isMesh) return;
            child.frustumCulled = false;
            child.renderOrder = -1000;
            child.castShadow = false;
            child.receiveShadow = false;

            // Unlit sky: keep vertex colours, ignore scene lights / fog.
            const basic = new THREE.MeshBasicMaterial({
                vertexColors: true,
                side: THREE.BackSide,
                fog: false,
                depthWrite: false,
                depthTest: true,
            });
            if (Array.isArray(child.material)) {
                child.material.forEach((m) => m?.dispose?.());
            } else {
                child.material?.dispose?.();
            }
            child.material = basic;
        });

        // Native mesh ≈ radius 2.6 hemisphere (y: 0 → 2.6). Scale to world radius.
        const nativeRadius = 2.6;
        const scale = SKY_TARGET_RADIUS / nativeRadius;
        dome.scale.setScalar(scale);
        dome.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(dome);
        const center = box.getCenter(new THREE.Vector3());
        // After scale, center.y is in local/world space with position still at origin.
        this._skyCenterOffsetY = center.y;
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

        if (!this.sharedBackdropMaterials) {
            this.sharedBackdropMaterials = {
                base: new THREE.MeshLambertMaterial({
                    color: 0x6DB973,
                    fog: true,
                }),
                ring: new THREE.MeshLambertMaterial({
                    color: 0x6DB973,
                    fog: true,
                    depthWrite: true,
                }),
            };
        }

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
