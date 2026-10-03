/**
 * Everything a hamlet's 3D scene owns, so that leaving the hamlet releases it all.
 *
 * `track(object)` is called for each root a hamlet creates (building, terrain tile, zone group,
 * overlay...). `disposeAll()` removes each root from its parent, then walks its subtree and frees
 * the geometries, materials and textures it owns. Resources that are shared across hamlets (the
 * asset manager's pooled geometry, terrain and sprite materials) are never freed: they are
 * registered with `markShared`, or they belong to a set the owner passes in.
 *
 * GPU memory is what this exists for: `Object3D.clear()` only detaches a child, the buffers
 * stay allocated in the WebGL context for the life of the page.
 */

const textureSlots = [
  'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap', 'displacementMap',
  'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap', 'specularMap', 'gradientMap',
  'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap',
  'sheenRoughnessMap', 'transmissionMap', 'thicknessMap', 'iridescenceMap', 'matcap',
];

export class HamletResourceRegistry {
  /** @type {Set<object>} Root objects this hamlet added to the scene. */
  #roots = new Set();
  /** @type {Set<object>} Resources that must never be disposed here (shared across hamlets). */
  #shared = new Set();
  /** @type {() => Iterable<object>} The long-lived pool, read at dispose time (some are created lazily). */
  #sharedPool;

  /**
   * @param {{ scene: object, sharedResources?: () => Iterable<object> }} options
   *   `sharedResources` — a function returning the geometries/materials/textures owned by a
   *   long-lived pool (asset manager). Read at each disposeAll, since parts of it appear lazily.
   */
  constructor({ scene, sharedResources = () => [] }) {
    this.scene = scene;
    this.#sharedPool = sharedResources;
  }


  /** @param {object} object An Object3D this hamlet owns. Returns it for chaining. */
  track(object) {
    if (!object) throw new Error('[HamletResourceRegistry] track() needs an object');
    this.#roots.add(object);
    return object;
  }

  /** A resource some other owner keeps alive: never disposed by this registry. */
  markShared(resource) {
    if (resource) this.#shared.add(resource);
    return resource;
  }

  get rootCount() {
    return this.#roots.size;
  }

  /**
   * Remove every tracked root from the scene and free what it owns.
   * @returns {{ geometries: number, materials: number, textures: number }} What was freed.
   */
  disposeAll() {
    const freed = { geometries: 0, materials: 0, textures: 0 };
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    const disposedTextures = new Set();
    const pooled = new Set(this.#sharedPool());
    const isShared = (resource) => this.#shared.has(resource) || pooled.has(resource);

    for (const root of this.#roots) {
      root.removeFromParent?.();
      root.traverse?.((node) => {
        const geometry = node.geometry;
        if (geometry && !isShared(geometry) && !disposedGeometries.has(geometry)) {
          geometry.dispose?.();
          disposedGeometries.add(geometry);
          freed.geometries += 1;
        }

        const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
        for (const material of materials) {
          if (!material || isShared(material) || disposedMaterials.has(material)) continue;
          for (const slot of textureSlots) {
            const texture = material[slot];
            if (!texture || isShared(texture) || disposedTextures.has(texture)) continue;
            texture.dispose?.();
            disposedTextures.add(texture);
            freed.textures += 1;
          }
          material.dispose?.();
          disposedMaterials.add(material);
          freed.materials += 1;
        }
      });
    }

    this.#roots.clear();
    return freed;
  }
}
