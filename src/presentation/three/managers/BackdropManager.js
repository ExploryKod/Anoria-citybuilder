import * as THREE from 'three';
import { isCustomMapLayoutActive } from '../../../shared/gameplay/customMapLayout.js';
import { isEditorMode } from '../../../shared/gameplay/gameMode.js';
import { WORLD_PLATFORM_Y } from '../../../shared/terrain-catalog/terrainWorldContract.js';
import {
  createSceneFog,
  KENNEY_GROUND_GRASS_COLOR,
  SCENE_EDITOR_BACKDROP_COLOR,
  SCENE_SKY_COLOR,
} from '../../../shared/terrain-catalog/terrainAtmosphere.js';

/**
 * Cheap infinite ground + sky colors (no GLB sky dome).
 * Playable grid uses 3D Kenney tiles; this fills the rest in 1–2 draw calls.
 * Editor mode: flat backdrop color only — no Kenney ground plane.
 */
export class BackdropManager {
    constructor(scene) {
        this.scene = scene;
        /** @type {THREE.MeshBasicMaterial | null} */
        this._groundFillMaterial = null;
    }

    applyAtmosphere() {
        if (isEditorMode() || isCustomMapLayoutActive()) {
            this.scene.background = new THREE.Color(SCENE_EDITOR_BACKDROP_COLOR);
            this.scene.fog = null;
            this._removeGroundFill();
            return;
        }

        this.scene.background = new THREE.Color(SCENE_SKY_COLOR);
        this.scene.fog = createSceneFog({ editor: false });
    }

    _removeGroundFill() {
        const groundFill = this.scene.getObjectByName('kenney-ground-fill');
        if (!groundFill) return;
        groundFill.geometry?.dispose();
        this.scene.remove(groundFill);
    }

    /**
     * One large ground plane under the playable Kenney grid (replaces village world mesh).
     * @param {number} citySize
     */
    syncGroundFill(citySize = 16) {
        if (isEditorMode() || isCustomMapLayoutActive()) {
            this._removeGroundFill();
            return;
        }

        const cityCenter = citySize / 2;
        const margin = Math.max(citySize * 2, 48);
        const planeSize = citySize + margin * 2;
        const fillColor = KENNEY_GROUND_GRASS_COLOR;
        const groundY = WORLD_PLATFORM_Y;

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
