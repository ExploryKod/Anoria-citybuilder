import * as THREE from 'three';

/**
 * Manages performance optimizations (frustum culling, shadow casting)
 */
export class PerformanceManager {
    constructor(scene, camera, zoneGroups, buildings) {
        this.scene = scene;
        this.camera = camera;
        this.zoneGroups = zoneGroups;
        this.buildings = buildings;
        this.lastFrustumUpdateCameraPosition = new THREE.Vector3();
        this.lastShadowUpdateCameraPosition = new THREE.Vector3();
        this.FRUSTUM_UPDATE_THRESHOLD = 3;
        this.SHADOW_UPDATE_THRESHOLD = 5;
    }

    /**
     * Update frustum culling for zone groups
     */
    updateFrustumCulling() {
        const currentCameraPos = this.camera.camera.position.clone();
        const distanceMoved = currentCameraPos.distanceTo(this.lastFrustumUpdateCameraPosition);

        if (distanceMoved < this.FRUSTUM_UPDATE_THRESHOLD && this.zoneGroups.length > 0) {
            return;
        }

        this.lastFrustumUpdateCameraPosition.copy(currentCameraPos);

        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4();
        matrix.multiplyMatrices(this.camera.camera.projectionMatrix, this.camera.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(matrix);

        this.zoneGroups.forEach(zoneGroup => {
            if (zoneGroup.children.length === 0) {
                zoneGroup.visible = false;
                return;
            }

            const box = new THREE.Box3();
            zoneGroup.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    box.expandByObject(child);
                }
            });

            zoneGroup.visible = frustum.intersectsBox(box);
        });
    }

    /**
     * Limit which buildings cast shadows by camera distance.
     * Does NOT resize/dispose the shadow map (that flashes the whole scene).
     * Does NOT toggle receiveShadow (that also flashes lit materials).
     */
    updateShadowCasting(maxShadowDistance = 50) {
        const currentCameraPos = this.camera.camera.position.clone();
        const distanceMoved = currentCameraPos.distanceTo(this.lastShadowUpdateCameraPosition);

        if (distanceMoved < this.SHADOW_UPDATE_THRESHOLD) {
            return;
        }

        this.lastShadowUpdateCameraPosition.copy(currentCameraPos);

        let changed = false;
        for (let x = 0; x < this.buildings.length; x++) {
            for (let y = 0; y < this.buildings[x]?.length; y++) {
                const building = this.buildings[x]?.[y];
                if (!building) continue;

                const distance = currentCameraPos.distanceTo(building.position);
                const shouldCastShadow = distance < maxShadowDistance;

                building.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.castShadow !== shouldCastShadow) {
                        child.castShadow = shouldCastShadow;
                        child.receiveShadow = true;
                        changed = true;
                    }
                });
            }
        }

        if (changed) {
            this.scene.userData.requestShadowRefresh?.();
        }
    }
}
