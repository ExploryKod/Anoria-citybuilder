/**
 * What the draw calls of one frame are made of (docs/plan/performance.plan.md, step 0): a reading of the scene as it stands, to be taken where the game is slow.
 *
 * A draw call is, to a close approximation, one visible mesh per material it carries. The reading counts them, tells them by what they belong to, and measures what
 * instancing would save: the meshes that share the same geometry and the same material could be one call, and the ones that share a geometry but carry material copies
 * are the ones a cloned material keeps apart.
 */

/** The name a mesh is told by: the nearest object above it that says what it is, else the name of the group it hangs under. */
function categoryOf(mesh, scene) {
  let node = mesh;
  let top = mesh;
  while (node && node !== scene) {
    const { userData } = node;
    const said = userData?.assetId ?? userData?.buildingType ?? userData?.type ?? userData?.kind;
    if (typeof said === 'string' && said.length > 0) return said;
    top = node;
    node = node.parent;
  }
  return `(sans nom) ${top.name || top.type}`;
}

/**
 * @param {import('three').Scene} scene
 * @param {import('three').WebGLRenderer} renderer
 * @param {{ top?: number }} [options] how many categories to list, the heaviest first
 * @returns {{
 *   frame: { drawCalls: number, triangles: number, geometries: number, textures: number },
 *   scene: { visibleMeshes: number, estimatedCalls: number, shadowCasters: number, instancedMeshes: number },
 *   instancing: { sameGeometryAndMaterial: { groups: number, callsSaved: number }, sameGeometryOnly: { groups: number, callsSaved: number } },
 *   byCategory: Array<{ category: string, meshes: number, calls: number, shadowCasters: number }>,
 * }}
 */
export function describeRenderLoad(scene, renderer, { top = 15 } = {}) {
  const byCategory = new Map();
  const byGeometryAndMaterial = new Map();
  const byGeometry = new Map();
  let visibleMeshes = 0;
  let estimatedCalls = 0;
  let shadowCasters = 0;
  let instancedMeshes = 0;

  scene.traverseVisible((object) => {
    if (!object.isMesh) return;
    visibleMeshes += 1;
    const calls = Array.isArray(object.material) ? object.material.length : 1;
    estimatedCalls += calls;
    if (object.castShadow) shadowCasters += 1;
    if (object.isInstancedMesh) {
      // One call whatever its count: already what instancing would give.
      instancedMeshes += 1;
      return;
    }

    const category = categoryOf(object, scene);
    const entry = byCategory.get(category) ?? { category, meshes: 0, calls: 0, shadowCasters: 0 };
    entry.meshes += 1;
    entry.calls += calls;
    if (object.castShadow) entry.shadowCasters += 1;
    byCategory.set(category, entry);

    const materialKey = Array.isArray(object.material) ? object.material.map((material) => material.uuid).join('+') : object.material.uuid;
    const both = `${object.geometry.uuid}|${materialKey}`;
    byGeometryAndMaterial.set(both, (byGeometryAndMaterial.get(both) ?? 0) + 1);
    byGeometry.set(object.geometry.uuid, (byGeometry.get(object.geometry.uuid) ?? 0) + 1);
  });

  const saved = (groups) => [...groups.values()].reduce((sum, count) => sum + (count - 1), 0);
  const { render, memory } = renderer.info;
  return {
    // `render.drawCalls`: this frame's. (`render.calls` of the WebGPU renderer counts render() calls since the start and only grows.)
    frame: { drawCalls: render.drawCalls, triangles: render.triangles, geometries: memory.geometries, textures: memory.textures },
    scene: { visibleMeshes, estimatedCalls, shadowCasters, instancedMeshes },
    instancing: {
      sameGeometryAndMaterial: { groups: byGeometryAndMaterial.size, callsSaved: saved(byGeometryAndMaterial) },
      sameGeometryOnly: { groups: byGeometry.size, callsSaved: saved(byGeometry) },
    },
    byCategory: [...byCategory.values()].sort((a, b) => b.calls - a.calls).slice(0, top),
  };
}

/**
 * The reading, written to the console where it can be copied: the totals, then one row per category.
 * @param {import('three').Scene} scene
 * @param {import('three').WebGLRenderer} renderer
 */
export function logRenderLoad(scene, renderer) {
  const reading = describeRenderLoad(scene, renderer);
  console.info('[render-load] frame', reading.frame);
  console.info('[render-load] scene', reading.scene);
  console.info('[render-load] instancing (calls that instancing would save)', reading.instancing);
  console.info('[render-load] by category (the heaviest first)');
  console.table(reading.byCategory);
  return reading;
}
