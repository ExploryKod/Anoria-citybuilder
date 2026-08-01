import * as THREE from 'three';
import { renderingConfig } from '../presentationConfig.js';

const STORAGE_KEY = 'anoria.tileGridVisible';
const OVERLAY_NAME = 'tile-grid-overlay';

/**
 * Visual-only tile grid (1×1 cases). No raycast / collision.
 */
export class TileGridOverlay {
  constructor() {
    /** @type {THREE.Group | null} */
    this.group = null;
    /** @type {THREE.Scene | null} */
    this.scene = null;
    this.citySize = 0;
    this.visible = readStoredVisibility();
  }

  /**
   * @param {THREE.Scene} scene
   * @param {number} citySize
   */
  rebuild(scene, citySize) {
    this.dispose();
    this.scene = scene;
    this.citySize = Math.max(1, Math.floor(citySize) || 16);

    const opacity = renderingConfig?.grid?.opacity ?? 0.35;
    const y = 0.34;
    const half = 0.5;
    const n = this.citySize;
    const min = -half;
    const max = n - half;

    /** @type {number[]} */
    const positions = [];

    for (let i = 0; i <= n; i++) {
      const edge = min + i;
      // lines parallel to Z (constant X)
      positions.push(edge, y, min, edge, y, max);
      // lines parallel to X (constant Z)
      positions.push(min, y, edge, max, y, edge);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x3d5c4a,
      transparent: true,
      opacity,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(geometry, material);
    lines.name = OVERLAY_NAME;
    lines.raycast = () => {};
    lines.userData = { nonInteractive: true, isTileGrid: true };
    lines.frustumCulled = false;

    this.group = new THREE.Group();
    this.group.name = OVERLAY_NAME;
    this.group.userData = { nonInteractive: true, isTileGrid: true };
    this.group.add(lines);
    this.group.visible = this.visible;
    this.group.raycast = () => {};

    scene.add(this.group);
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.visible = !!visible;
    if (this.group) {
      this.group.visible = this.visible;
    }
    try {
      localStorage.setItem(STORAGE_KEY, this.visible ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }

  isVisible() {
    return this.visible;
  }

  dispose() {
    if (!this.group) return;

    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    if (this.scene) {
      this.scene.remove(this.group);
    }
    this.group = null;
  }
}

export function readStoredTileGridVisibility() {
  return readStoredVisibility();
}

function readStoredVisibility() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
