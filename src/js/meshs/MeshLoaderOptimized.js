import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { meshNameMapping } from './data.js';

// Import JSON catalog - adjust path as needed
let assetCatalog;

async function loadAssetCatalog() {
    if (!assetCatalog) {
        const response = await fetch('/village_town_assets.json');
        assetCatalog = await response.json();
    }
    return assetCatalog;
}

/**
 * Optimized MeshLoader that uses JSON catalog for better performance
 * 
 * Improvements:
 * 1. Pre-built lookup tables from JSON (no parsing at runtime)
 * 2. Uses Sets for O(1) lookup instead of array includes
 * 3. Skips meshes we don't need
 * 4. Batch processing instead of per-mesh checks
 * 5. Early exit patterns
 */
class MeshLoaderOptimized {

    toolIds = {
        zones: ['grass', 'roads'],
        houses: ['House-Blue', 'House-Red', 'House-Purple', 'House-2Story'],
        tombs: ['Tombstone-1', 'Tombstone-2', 'Tombstone-3'],
        farms: ['Farm-Wheat', 'Farm-Carrot', 'Farm-Cabbage', 'Windmill-001', 'Barn-001'],
        markets: ['Market-Stall'],
        infrastructure: ['Well-001', 'Fountain-001', 'Streetlight-001'],
        public: ['Chapel-001', 'Church-002'],
        nature: []
    }

    allAssetsNames = [
        { houses: [] },
        { nature: [] },
        { farms: [] },
        { markets: [] },
        { infrastructure: [] },
        { public: [] },
        { other: [] }
    ];

    buttonData = [];
    modelsObj = {
        'houses': {},
        'tombs': {},
        'farms': {},
        'markets': {},
        'infrastructure': {},
        'public': {},
        'nature': {}
    }

    modelMetas = {
        'houses': { size: 0.5 },
        'tombs': { size: 0.5 },
        'farms': { size: 1 },
        'markets': { size: 0.7 },
        'infrastructure': { size: 0.8 },
        'public': { size: 1.2 },
        'nature': { size: 0.5 }
    }

    assetNames = [];

    constructor() {
        // Lookup tables will be built when loadAssets is called
        this.validMeshNames = new Set();
        this.meshToToolName = new Map();
        this.toolToCategory = new Map();
        this.categoryMeshSets = {
            houses: new Set(),
            farms: new Set(),
            markets: new Set(),
            tombs: new Set()
        };
    }

    /**
     * Build fast lookup tables from the JSON catalog
     * This happens once at initialization instead of at runtime
     */
    async _buildLookupTables() {
        // Load catalog if not already loaded
        const assetCatalog = await loadAssetCatalog();
        // Set of all mesh names we care about (from JSON)
        this.validMeshNames = new Set();
        
        // Map: mesh name → tool name
        this.meshToToolName = new Map();
        
        // Map: tool name → category
        this.toolToCategory = new Map();
        
        // Category → Set of valid mesh names
        this.categoryMeshSets = {
            houses: new Set(),
            farms: new Set(),
            markets: new Set(),
            tombs: new Set(),
            infrastructure: new Set(),
            public: new Set()
        };

        // Build catalog mappings
        Object.entries(assetCatalog.assets).forEach(([category, data]) => {
            data.mesh_names?.forEach(meshName => {
                this.validMeshNames.add(meshName);
                this.categoryMeshSets[category]?.add(meshName);
                
                // Parse mesh name to tool name
                const toolName = this._parseMeshNameToToolName(meshName);
                this.meshToToolName.set(meshName, toolName);
                
                // Track which category this tool belongs to
                if (this.toolIds[category]?.includes(toolName)) {
                    this.toolToCategory.set(toolName, category);
                }
            });
        });
    }

    /**
     * Parse mesh name to tool name (same logic as before but extracted for reuse)
     */
    _parseMeshNameToToolName(meshName) {
        // Remove _MaterialXXX_X suffix
        const baseName = meshName.split('_Material')[0];
        
        // Check if base name or any variant needs special mapping
        for (const [variant, mappedName] of Object.entries(meshNameMapping)) {
            if (baseName === variant || baseName.startsWith(variant)) {
                return mappedName;
            }
        }
        
        // Standard parsing for objects like Farm_Wheat, House_Blue, etc.
        const normalized = baseName.replace(/[.\s]/g, '_');
        const parts = normalized.split('_');
        let toolName = `${parts[0]}-${parts[1] || ''}`;
        
        // Apply mapping if needed
        if (meshNameMapping[toolName]) {
            return meshNameMapping[toolName];
        }
        
        return toolName;
    }

    /**
     * Check if a mesh is in our catalog and which category it belongs to
     */
    _getMeshCategory(meshName) {
        // Fast lookup in Sets
        for (const [category, meshSet] of Object.entries(this.categoryMeshSets)) {
            if (meshSet.has(meshName)) {
                return category;
            }
        }
        return null;
    }

    /**
     * Optimized asset loading using JSON catalog
     */
    async loadAssets(assetFullName, propertyKey, modelsObj, allAssetsNames, assetNames, toolIds, buttonData) {
        // Build lookup tables once (will be cached after first call)
        await this._buildLookupTables();
        
        return new Promise((resolve, reject) => {
            const gltfloader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/examples/jsm/libs/draco/');
            gltfloader.setDRACOLoader(dracoLoader);

            // Track what we've already processed to avoid duplicates
            const processedMeshes = new Set();

            gltfloader.load(
                `./resources/lowpoly/village_town_assets_v2.glb`,
                
                // Success callback
                function (gltf) {
                    // Single pass through all meshes
                    gltf.scene.traverse(function (child) {
                        if (!(child instanceof THREE.Mesh)) {
                            return; // Skip non-meshes
                        }

                        const meshName = child.name;
                        
                        // Early exit: Skip if we don't care about this mesh
                        if (!this.validMeshNames.has(meshName)) {
                            return; // Skip unknown meshes
                        }

                        // Early exit: Skip if already processed
                        if (processedMeshes.has(meshName)) {
                            return;
                        }
                        processedMeshes.add(meshName);

                        // Get category from JSON catalog
                        const category = this._getMeshCategory(meshName);
                        if (!category) {
                            return;
                        }

                        // Get tool name from pre-built map
                        const toolName = this.meshToToolName.get(meshName);
                        if (!toolName) {
                            return;
                        }

                        // Check if this tool is in our toolIds
                        if (!toolIds[category]?.includes(toolName)) {
                            return;
                        }

                        // Only process if it matches the requested category
                        if (category !== propertyKey) {
                            return;
                        }

                        // Parse mesh name parts for button text
                        const normalized = meshName.replace(/[._\s]/g, '_');
                        const firstNamePart = normalized.split('_')[0];
                        const secondNamePart = normalized.split('_')[1] || '';


                        // Store mesh
                        modelsObj[propertyKey][toolName] = child;
                        assetNames.push(toolName);

                        // Add to button data
                        buttonData.push({
                            text: `${firstNamePart} ${secondNamePart}`,
                            tool: toolName,
                            group: firstNamePart
                        });

                        // Add to asset array
                        const assetArray = allAssetsNames.find(a => a[propertyKey]);
                        if (assetArray) {
                            assetArray[propertyKey].push({
                                fullName: child.userData.name,
                                name: toolName,
                                mesh: child
                            });
                        }
                    }.bind(this)); // Bind 'this' to access class methods

                    resolve(modelsObj);
                }.bind(this),
                
                // Progress callback
                function (xhr) {
                    // Loading progress
                },
                
                // Error callback
                function (error) {
                    console.error('An error happened', error);
                    reject(error);
                }
            );
        });
    }
}

export default MeshLoaderOptimized;

