import * as THREE from 'three';

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
 * Editor Kenney GLBs are authored unlit (preview PNGs). Disable fog + tone mapping
 * so placed assets match the carousel previews instead of the gameplay island look.
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
 * @param {THREE.Mesh} mesh
 * @param {{ renderOrder?: number }} [options]
 */
export function applyKenneyGltfMeshDefaults(mesh, options = {}) {
  mesh.castShadow = false;
  mesh.receiveShadow = false;
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
      applyKenneyGltfMeshDefaults(child, options);
    }
  });
}
