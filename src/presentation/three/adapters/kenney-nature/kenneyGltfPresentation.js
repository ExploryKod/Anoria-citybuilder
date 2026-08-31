import * as THREE from 'three';

/** @typedef {'unlit' | 'lit'} KenneyGltfPresentationMode */

/**
 * 3D scene presentation — lit Lambert + shadows.
 * Carousel icons use Isometric PNGs (see editorKenneyCatalog EDITOR_TOOL_PREVIEW_URLS).
 *
 * @returns {KenneyGltfPresentationMode}
 */
export function resolveKenneyGltfPresentationMode() {
  return 'lit';
}

/**
 * @param {THREE.Material} material
 * @returns {THREE.MeshBasicMaterial}
 */
function ensureEditorUnlitMaterial(material) {
  if (material instanceof THREE.MeshBasicMaterial) {
    material.fog = false;
    material.toneMapped = false;
    return material;
  }

  const basic = new THREE.MeshBasicMaterial({
    color: material.color?.clone?.() ?? new THREE.Color(0xffffff),
    map: material.map ?? null,
    alphaMap: material.alphaMap ?? null,
    transparent: material.transparent === true,
    opacity: material.opacity ?? 1,
    side: material.side ?? THREE.FrontSide,
    depthWrite: material.depthWrite !== false,
    fog: false,
    toneMapped: false,
  });

  if (basic.map) {
    basic.map.colorSpace = THREE.SRGBColorSpace;
  }

  material.dispose?.();
  return basic;
}

/**
 * @param {THREE.Material} material
 * @returns {THREE.MeshLambertMaterial}
 */
function ensureLitLambertMaterial(material) {
  if (material instanceof THREE.MeshLambertMaterial) {
    if (material.map) {
      material.map.colorSpace = THREE.SRGBColorSpace;
    }
    return material;
  }

  const lambert = new THREE.MeshLambertMaterial({
    color: material.color?.clone?.() ?? new THREE.Color(0xffffff),
    map: material.map ?? null,
    alphaMap: material.alphaMap ?? null,
    transparent: material.transparent === true,
    opacity: material.opacity ?? 1,
    side: material.side ?? THREE.FrontSide,
    depthWrite: material.depthWrite !== false,
  });

  if (lambert.map) {
    lambert.map.colorSpace = THREE.SRGBColorSpace;
  }

  material.dispose?.();
  return lambert;
}

/**
 * Legacy unlit 3D path (MeshBasicMaterial). Prefer {@link applyLitKenneyGltfPresentation}
 * for placed meshes — carousel previews stay as static PNGs in the toolbar.
 *
 * @param {THREE.Object3D} root
 */
export function normalizeEditorKenneyGltfMaterials(root) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const nextMaterials = sourceMaterials.map((material) => ensureEditorUnlitMaterial(material));
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
  });
}

/**
 * Gameplay on custom maps — same albedo as the GLB but reacts to scene lights + shadows.
 *
 * @param {THREE.Object3D} root
 */
export function normalizeLitKenneyGltfMaterials(root) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const nextMaterials = sourceMaterials.map((material) => ensureLitLambertMaterial(material));
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
  });
}

/**
 * @param {THREE.Mesh} mesh
 * @param {{ renderOrder?: number, castShadow?: boolean, receiveShadow?: boolean }} [options]
 */
export function applyKenneyGltfMeshDefaults(mesh, options = {}) {
  mesh.castShadow = options.castShadow === true;
  mesh.receiveShadow = options.receiveShadow === true;
  if (options.renderOrder != null) {
    mesh.renderOrder = options.renderOrder;
  }
}

/**
 * @param {THREE.Object3D} root
 * @param {{ renderOrder?: number }} [options]
 */
export function applyEditorKenneyGltfPresentation(root, options = {}) {
  normalizeEditorKenneyGltfMaterials(root);
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      applyKenneyGltfMeshDefaults(child, {
        ...options,
        castShadow: false,
        receiveShadow: false,
      });
    }
  });
}

/**
 * @param {THREE.Object3D} root
 * @param {{ renderOrder?: number, role?: 'prop' | 'terrain' }} [options]
 */
export function applyLitKenneyGltfPresentation(root, options = {}) {
  const role = options.role ?? 'prop';
  normalizeLitKenneyGltfMaterials(root);
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      applyKenneyGltfMeshDefaults(child, {
        renderOrder: options.renderOrder,
        castShadow: role === 'prop',
        receiveShadow: true,
      });
    }
  });
}
