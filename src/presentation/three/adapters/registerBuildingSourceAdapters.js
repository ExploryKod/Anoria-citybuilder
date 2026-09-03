// Composition root for BuildingSourceAdapter registration — the ONE file
// allowed to enumerate every concrete building source by name. Imported
// once (for its side effects) by resolveBuildingMesh.js, so every consumer
// (scene.js, placementGhost.js, /placement.html) gets a populated registry
// without needing to know this list exists.
//
// Adding a new GLB pack: write one adapter file implementing
// BuildingSourceAdapter (see buildingSourceAdapterRegistry.js), add one
// import line below. Nothing else in the codebase changes.

import './village-town/villageTownBuildingAdapter.js';
import './kenney-city-kit/kenneyCityKitBuildingAdapter.js';
