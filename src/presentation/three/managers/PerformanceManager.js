import * as THREE from 'three';
import { getSceneTilePortFromObject } from '../scene-board/SceneTilePort.js';

/**
 * Manages performance optimizations (frustum culling, shadow casting)
 */
const MIN_ZONE_BOUNDS_HEIGHT = 0.5;
/** How far a zone's box is grown for a pick, in world units: a pick that misses a mesh is worse than one that tests a zone too many. */
const ZONE_PICK_PADDING = 1;

export class PerformanceManager {
    constructor(scene, camera, zoneGroups, buildings) {
        this.scene = scene;
        this.camera = camera;
        this.zoneGroups = zoneGroups;
        this.buildings = buildings;
        this.lastShadowUpdateCameraPosition = new THREE.Vector3();
        this.SHADOW_UPDATE_THRESHOLD = 5;
        // Culling: the last view (projection × view) a pass ran for, and the bounding box of each zone.
        // A pass runs when that view changes (pan, rotation, zoom, resize), when a zone gained or lost
        // a mesh, or when asked (`invalidateFrustumCache`). A zone's box is rebuilt only when its
        // content changed, so a pass is one box-versus-frustum test per zone.
        this.lastCullingView = new THREE.Matrix4();
        this.cullingViewKnown = false;
        this.cullingForced = true;
        this.zoneBounds = new WeakMap();
        this.frustum = new THREE.Frustum();
        this.viewMatrix = new THREE.Matrix4();
        // Counts every mesh added to or removed from a zone: whoever caches something about what the zones hold (the hover pick) re-reads it when this moves.
        this.contentVersion = 0;
        this.rayBox = new THREE.Box3();
    }

    /**
     * The zones a ray may hit something in: those whose box it crosses (the box is padded, a mesh that moved a little after it was added still counts).
     * Lets a pick raycast a handful of zones instead of every mesh of the city.
     * @param {import('three').Ray} ray
     * @returns {import('three').Group[]}
     */
    zonesAlongRay(ray) {
        const crossed = [];
        for (const zoneGroup of this.zoneGroups) {
            if (zoneGroup.children.length === 0) continue;
            const entry = this.boundsEntryOf(zoneGroup);
            if (entry.dirty) {
                this.rebuildZoneBox(zoneGroup, entry.box);
                entry.dirty = false;
            }
            if (entry.box.isEmpty()) continue;
            this.rayBox.copy(entry.box).expandByScalar(ZONE_PICK_PADDING);
            if (ray.intersectsBox(this.rayBox)) crossed.push(zoneGroup);
        }
        return crossed;
    }

    /**
     * Force the next frustum pass to run (e.g. after placing editor tiles into an empty zone).
     */
    invalidateFrustumCache() {
        this.cullingForced = true;
    }

    /**
     * The zone's box is kept in `zoneBounds`; whatever adds or removes a child of the zone, whichever
     * code path it is, marks it dirty (the zone's own `add`/`remove` are wrapped once).
     */
    boundsEntryOf(zoneGroup) {
        let entry = this.zoneBounds.get(zoneGroup);
        if (entry) return entry;
        entry = { box: new THREE.Box3(), dirty: true };
        this.zoneBounds.set(zoneGroup, entry);
        const manager = this;
        const add = zoneGroup.add;
        const remove = zoneGroup.remove;
        zoneGroup.add = function (...objects) {
            entry.dirty = true;
            manager.cullingForced = true;
            manager.contentVersion += 1;
            // A mesh just placed shows at once; the next pass decides if it stays.
            if (objects.length > 0) this.visible = true;
            return add.apply(this, objects);
        };
        zoneGroup.remove = function (...objects) {
            entry.dirty = true;
            manager.cullingForced = true;
            manager.contentVersion += 1;
            return remove.apply(this, objects);
        };
        return entry;
    }

    rebuildZoneBox(zoneGroup, box) {
        box.makeEmpty();
        zoneGroup.children.forEach((child) => {
            const port = getSceneTilePortFromObject(child);
            if (port) {
                const tileBounds = port.getBounds();
                if (!tileBounds.isEmpty()) {
                    box.union(tileBounds);
                }
                return;
            }
            box.expandByObject(child);
        });

        if (!box.isEmpty()) {
            const height = box.max.y - box.min.y;
            if (height < MIN_ZONE_BOUNDS_HEIGHT) {
                const centerY = (box.min.y + box.max.y) * 0.5;
                const halfHeight = MIN_ZONE_BOUNDS_HEIGHT * 0.5;
                box.min.y = centerY - halfHeight;
                box.max.y = centerY + halfHeight;
            }
        }
    }

    /**
     * @param {boolean} [editorMode=false] — editor keeps all zones visible (no aggressive culling).
     */
    updateFrustumCulling(editorMode = false) {
        if (editorMode) {
            this.zoneGroups.forEach((zoneGroup) => {
                zoneGroup.visible = zoneGroup.children.length > 0;
            });
            return;
        }

        // The renderer refreshes the camera's view matrix only when it renders, after this call:
        // refresh it here so the frustum is the one of the frame about to be drawn.
        const camera = this.camera.camera;
        camera.updateMatrixWorld();
        this.viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

        // Register every zone (hooks its add/remove) before deciding whether a pass is due.
        this.zoneGroups.forEach((zoneGroup) => this.boundsEntryOf(zoneGroup));

        const viewChanged = !this.cullingViewKnown || !this.viewMatrix.equals(this.lastCullingView);
        if (!viewChanged && !this.cullingForced && this.zoneGroups.length > 0) {
            return;
        }

        this.lastCullingView.copy(this.viewMatrix);
        this.cullingViewKnown = true;
        this.cullingForced = false;
        this.frustum.setFromProjectionMatrix(this.viewMatrix);

        this.zoneGroups.forEach((zoneGroup) => {
            if (zoneGroup.children.length === 0) {
                zoneGroup.visible = false;
                return;
            }

            const entry = this.boundsEntryOf(zoneGroup);
            if (entry.dirty) {
                this.rebuildZoneBox(zoneGroup, entry.box);
                entry.dirty = false;
            }

            zoneGroup.visible = !entry.box.isEmpty() && this.frustum.intersectsBox(entry.box);
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
                    if (child.userData.castsNoShadow) return;
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
