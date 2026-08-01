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
        
        let zonesHidden = 0;
        let zonesVisible = 0;
        
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
            
            const isVisible = frustum.intersectsBox(box);
            zoneGroup.visible = isVisible;
            
            if (isVisible) {
                zonesVisible++;
            } else {
                zonesHidden++;
            }
        });
    }

    /**
     * Update shadow casting based on distance from camera
     */
    updateShadowCasting(maxShadowDistance = 50) {
        const currentCameraPos = this.camera.camera.position.clone();
        const distanceMoved = currentCameraPos.distanceTo(this.lastShadowUpdateCameraPosition);
        
        if (distanceMoved < this.SHADOW_UPDATE_THRESHOLD) {
            return;
        }
        
        this.lastShadowUpdateCameraPosition.copy(currentCameraPos);
        
        const shadowLight = this.scene.userData.shadowLight;
        const baseShadowMapSize = this.scene.userData.shadowMapBaseSize || 512;
        
        if (shadowLight && shadowLight.castShadow) {
            let totalDistance = 0;
            let buildingCount = 0;
            
            for(let x = 0; x < this.buildings.length; x++) {
                for(let y = 0; y < this.buildings[x]?.length; y++) {
                    const building = this.buildings[x]?.[y];
                    if (building) {
                        const distance = currentCameraPos.distanceTo(building.position);
                        if (distance < maxShadowDistance * 1.5) {
                            totalDistance += distance;
                            buildingCount++;
                        }
                    }
                }
            }
            
            if (buildingCount > 0) {
                const avgDistance = totalDistance / buildingCount;
                let dynamicSize = baseShadowMapSize;
                if (avgDistance > maxShadowDistance * 0.8) {
                    dynamicSize = Math.max(256, Math.floor(baseShadowMapSize * 0.5));
                } else if (avgDistance > maxShadowDistance * 0.5) {
                    dynamicSize = Math.max(256, Math.floor(baseShadowMapSize * 0.75));
                }
                
                if (Math.abs(shadowLight.shadow.mapSize.width - dynamicSize) > 64) {
                    shadowLight.shadow.mapSize.width = dynamicSize;
                    shadowLight.shadow.mapSize.height = dynamicSize;
                    shadowLight.shadow.map?.dispose();
                    shadowLight.shadow.needsUpdate = true;
                }
            }
        }
        
        // Update shadows for all buildings
        let shadowUpdates = 0;
        for(let x = 0; x < this.buildings.length; x++) {
            for(let y = 0; y < this.buildings[x]?.length; y++) {
                const building = this.buildings[x]?.[y];
                if (building) {
                    const distance = currentCameraPos.distanceTo(building.position);
                    const shouldCastShadow = distance < maxShadowDistance;
                    
                    building.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            if (child.castShadow !== shouldCastShadow) {
                                child.castShadow = shouldCastShadow;
                                child.receiveShadow = shouldCastShadow;
                                shadowUpdates++;
                            }
                        }
                    });
                }
            }
        }
        
        if (shadowUpdates > 0) {
        }
    }
}
