import * as THREE from 'three';
import { isEditorMode } from '../../../shared/gameplay/gameMode.js';
import { WORLD_PLATFORM_Y } from '../../../shared/terrain-catalog/terrainWorldContract.js';
import {
  createSceneFog,
  KENNEY_GROUND_GRASS_COLOR,
  SCENE_SEA_COLOR,
  SCENE_SKY_COLOR,
} from '../../../shared/terrain-catalog/terrainAtmosphere.js';

/**
 * Cheap infinite ground + sky colors (no GLB sky dome).
 * Playable grid uses 3D Kenney tiles; this fills the rest in 1–2 draw calls.
 */
export class BackdropManager {
    constructor(scene) {
        this.scene = scene;
        /** @type {THREE.MeshBasicMaterial | null} */
        this._groundFillMaterial = null;
    }

    applyAtmosphere() {
        this.scene.background = new THREE.Color(SCENE_SKY_COLOR);
        this.scene.fog = createSceneFog({ editor: isEditorMode() });
    }

    /**
     * One large ground plane under the playable Kenney grid (replaces village world mesh).
     * @param {number} citySize
     */
    syncGroundFill(citySize = 16) {
        const cityCenter = citySize / 2;
        const editor = isEditorMode();
        // Extend well past the buildable grid so the iso camera never sees the plane edge.
        const margin = Math.max(citySize * 2, 48);
        const planeSize = citySize + margin * 2;
        const fillColor = editor ? SCENE_SEA_COLOR : KENNEY_GROUND_GRASS_COLOR;
        const groundY = editor ? WORLD_PLATFORM_Y - 0.12 : WORLD_PLATFORM_Y;

        if (!this._groundFillMaterial) {
            this._groundFillMaterial = new THREE.MeshBasicMaterial({
                color: fillColor,
                fog: true,
            });
        } else {
            this._groundFillMaterial.color.setHex(fillColor);
        }

        let groundFill = this.scene.getObjectByName('kenney-ground-fill');
        if (!groundFill) {
            const geometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);
            groundFill = new THREE.Mesh(geometry, this._groundFillMaterial);
            groundFill.name = 'kenney-ground-fill';
            groundFill.rotation.x = -Math.PI / 2;
            groundFill.receiveShadow = false;
            groundFill.renderOrder = -1;
            groundFill.frustumCulled = false;
            groundFill.userData = { nonInteractive: true, isGroundFill: true };
            this.scene.add(groundFill);
        } else {
            groundFill.geometry.dispose();
            groundFill.geometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);
        }

        groundFill.position.set(cityCenter, groundY, cityCenter);
    }

    /** @deprecated use applyAtmosphere */
    setSceneBackground() {
        this.applyAtmosphere();
    }

    /** @deprecated use syncGroundFill */
    addBackdrop(citySize = 16) {
        this.syncGroundFill(citySize);
    }
}
