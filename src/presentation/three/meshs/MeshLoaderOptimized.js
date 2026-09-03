import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { meshNameMapping } from './data.js';
import {
    VILLAGE_MESH_TOOL_IDS_BY_CATEGORY,
} from '../../../shared/building-catalog/villageAssetSets.js';

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

    /** Internal category/id bookkeeping used while loading — every village mesh id (Kenney added separately in VillageTownAssetManager). */
    toolIds = structuredClone(VILLAGE_MESH_TOOL_IDS_BY_CATEGORY);

    /** GLB meshes to load for legacy saves and procedural nature. */
    meshToolIds = structuredClone(VILLAGE_MESH_TOOL_IDS_BY_CATEGORY);

    allAssetsNames = [
        { houses: [] },
        { nature: [] },
        { farms: [] },
        { industry: [] },
        { markets: [] },
        { infrastructure: [] },
        { public: [] },
        { palaces: [] },
        { tombs: [] },
        { decoration: [] },
        { other: [] },
    ];

    buttonData = [];
    modelsObj = {
        houses: {},
        tombs: {},
        farms: {},
        industry: {},
        markets: {},
        infrastructure: {},
        public: {},
        palaces: {},
        nature: {},
        decoration: {},
    }

    modelMetas = {
        houses: { size: 0.5 },
        tombs: { size: 0.5 },
        farms: { size: 1 },
        industry: { size: 0.5 },
        markets: { size: 0.7 },
        infrastructure: { size: 0.8 },
        public: { size: 0.8 },
        palaces: { size: 0.5 },
        nature: { size: 0.5 },
        decoration: { size: 0.5 },
    }

    // Per-asset size overrides (for assets that need different size than their category)
    assetSizeOverrides = {
        'Windmill-001': 0.5, // Windmills should match one case size like houses
        // Wheat silo: industry default 0.5 × 10
        Cylinder: 5,
        'Winery-001': 0.009,
        'BookShop-001': 0.002,
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
            industry: new Set(),
            markets: new Set(),
            tombs: new Set(),
            infrastructure: new Set(),
            public: new Set(),
            palaces: new Set(),
            nature: new Set(),
            decoration: new Set(),
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
            industry: new Set(),
            markets: new Set(),
            tombs: new Set(),
            infrastructure: new Set(),
            public: new Set(),
            palaces: new Set(),
            nature: new Set(),
            decoration: new Set(),
        };

        // Build catalog mappings
        // Map JSON categories to our internal categories
        const categoryMapping = {
            vegetation: 'nature',
            tombstones: 'tombs',
        };
        
        Object.entries(assetCatalog.assets).forEach(([jsonCategory, data]) => {
            // Map JSON category to our internal category
            const internalCategory = categoryMapping[jsonCategory] || jsonCategory;
            
            data.mesh_names?.forEach(meshName => {
                // Parse mesh name to tool name (null = discarded mesh)
                const toolName = this._parseMeshNameToToolName(meshName);
                if (!toolName) {
                    return;
                }

                this.validMeshNames.add(meshName);
                // Add to the internal category set
                if (this.categoryMeshSets[internalCategory]) {
                    this.categoryMeshSets[internalCategory].add(meshName);
                }
                
                this.meshToToolName.set(meshName, toolName);
                
                // Special handling: StonePath meshes should be in 'infrastructure' category
                if (toolName === 'StonePath-001' && this.categoryMeshSets['infrastructure']) {
                    this.categoryMeshSets['infrastructure'].add(meshName);
                }
                
                // Special handling: Boulder meshes should be in 'nature' category
                if (toolName === 'Boulder-001' && this.categoryMeshSets['nature']) {
                    this.categoryMeshSets['nature'].add(meshName);
                }

                // Crate lives under industry tools (also listed in JSON decoration)
                if (toolName === 'Crate-001' && this.categoryMeshSets['industry']) {
                    this.categoryMeshSets['industry'].add(meshName);
                }

                // Wheat silos: Cylinder* → single industry tool (JSON lists them under infrastructure)
                if (toolName === 'Cylinder' && this.categoryMeshSets['industry']) {
                    this.categoryMeshSets['industry'].add(meshName);
                }
                
                // Track which category this tool belongs to (mesh load list, not toolbar-only ids)
                for (const [cat, ids] of Object.entries(this.meshToolIds)) {
                    if (ids.includes(toolName)) {
                        this.toolToCategory.set(toolName, cat);
                    }
                }
            });
        });
    }

    /** Prefer canonical colored house meshes over numbered variants. */
    _houseMeshPriority(meshName, toolName) {
        const base = meshName.split('_Material')[0];
        const canonical = {
            'House-Blue': 'House_Blue',
            'House-Red': 'House_Red',
            'House-Purple': 'House_Purple',
        };
        const preferred = canonical[toolName];
        if (!preferred) return 0;
        if (base === preferred) return 2;
        return 0;
    }

    /**
     * Parse mesh name to tool name (same logic as before but extracted for reuse)
     */
    _parseMeshNameToToolName(meshName) {
        // Remove _MaterialXXX_X suffix
        const baseName = meshName.split('_Material')[0];

        // Discard broken Church002 mesh (duplicate of Chapel, wrong scale)
        if (baseName === 'Church002' || baseName === 'Church_002') {
            return null;
        }

        // Numbered primitives: Plane/Sphere keep index; Cube + Cylinder pool to one tool
        const numberedPrim = baseName.match(/^(Plane|Cylinder|Sphere|Cube)(\d+)$/);
        if (numberedPrim) {
            if (numberedPrim[1] === 'Cube') return 'Cube';
            if (numberedPrim[1] === 'Cylinder') return 'Cylinder';
            return `${numberedPrim[1]}-${numberedPrim[2].padStart(3, '0')}`;
        }
        // Check if base name or any variant needs special mapping (check BEFORE standard parsing)
        // Sort mappings by length (descending) to check most specific first
        const sortedMappings = Object.entries(meshNameMapping).sort((a, b) => b[0].length - a[0].length);
        
        for (const [variant, mappedName] of sortedMappings) {
            // Check exact match
            if (baseName === variant) {
                return mappedName;
            }
            // Check if it starts with variant (for numbered variants like House_2Story_Purple001)
            // Avoid short prefixes that collide (e.g. Tomb vs Tombstone)
            if (variant.length >= 4 && baseName.startsWith(variant)) {
                const next = baseName[variant.length];
                if (!next || /\d/.test(next) || next === '_') {
                    return mappedName;
                }
            }
        }
        
        // Check if it's already a mapped tree name (Tree-Sapin, Tree-Arbuste, Tree-Chene)
        if (baseName === 'Tree-Sapin') return 'Tree-Pine-001';
        if (baseName === 'Tree-Arbuste') return 'Tree-Square-001';
        if (baseName === 'Tree-Chene') return 'Tree-Tall-001';

        // House.003 is a Y-up stray duplicate (height along local Y). Canonical
        // House_Blue / House_Red / House_Purple are Z-up like World — discard this mesh.
        if (baseName === 'House003' || baseName === 'House.003') {
            return null;
        }

        // Bare "House" without color suffix only
        if (baseName === 'House') {
            return 'House-Blue';
        }
        
        // Standard parsing for objects like Farm_Wheat, House_Blue, etc.
        const normalized = baseName.replace(/[.\s]/g, '_');
        const parts = normalized.split('_');
        
        // Special handling for Tree variants (Tree_Pine, Tree_Square, Tree_Tall)
        if (parts[0] === 'Tree' && parts.length >= 2) {
            const treeType = parts[1]; // Pine, Square, or Tall
            // Remove numbers from type (e.g., "Pine001" -> "Pine", "Tall018" -> "Tall")
            const cleanType = treeType.replace(/\d+$/, '');
            // Map to Tree-{Type}-001 format
            if (cleanType === 'Pine') return 'Tree-Pine-001';
            if (cleanType === 'Square') return 'Tree-Square-001';
            if (cleanType === 'Tall') return 'Tree-Tall-001';
            if (cleanType === 'Sapin') return 'Tree-Pine-001';
            if (cleanType === 'Arbuste') return 'Tree-Square-001';
            if (cleanType === 'Chene') return 'Tree-Tall-001';
        }

        // TreeSquare005 / TreeTall001 (no underscore)
        if (/^TreeSquare\d*$/.test(baseName)) return 'Tree-Square-001';
        if (/^TreeTall\d*$/.test(baseName)) return 'Tree-Tall-001';
        
        // Special handling for Crate (all variants map to Crate-001)
        if (parts[0] === 'Crate') {
            return 'Crate-001';
        }
        
        // Special handling for Boulder (all variants map to Boulder-001)
        if (parts[0] === 'Boulder') {
            return 'Boulder-001';
        }
        
        // Special handling for StonePath (all variants map to StonePath-001)
        if (parts[0] === 'StonePath') {
            return 'StonePath-001';
        }

        // Market_Stall_Blue / Market_Stall_Red
        if (parts[0] === 'Market' && parts[1] === 'Stall') {
            const color = (parts[2] || '').replace(/\d+$/, '');
            if (color === 'Blue') return 'Market-Stall-Blue';
            if (color === 'Red') return 'Market-Stall-Red';
            return 'Market-Stall';
        }

        // Grave_1 / Tombstone_1
        if (parts[0] === 'Grave') {
            const n = (parts[1] || '').replace(/0+\d*$/, (s) => s[0]) || parts[1];
            const idx = String(parts[1] || '').match(/^(\d)/);
            return idx ? `Grave-${idx[1]}` : 'Grave-1';
        }
        if (parts[0] === 'Tombstone') {
            const idx = String(parts[1] || '').match(/^(\d)/);
            return idx ? `Tombstone-${idx[1]}` : 'Tombstone-1';
        }
        
        let toolName = `${parts[0]}-${parts[1] || ''}`.replace(/-$/, '');
        
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
        // Categories are already mapped in _buildLookupTables
        for (const [category, meshSet] of Object.entries(this.categoryMeshSets)) {
            if (meshSet.has(meshName)) {
                // Return the internal category (already mapped in _buildLookupTables)
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

            // Use standardized asset path (can be overridden by passing baseUrl)
            const modelPath = assetFullName || `./resources/lowpoly/village_town_assets_v2.glb`;
            
            gltfloader.load(
                modelPath,
                
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

                        // Get category from JSON catalog (already mapped in _buildLookupTables)
                        const category = this._getMeshCategory(meshName);
                        if (!category) {
                            return;
                        }

                        // Get tool name from pre-built map
                        const toolName = this.meshToToolName.get(meshName);
                        if (!toolName) {
                            return;
                        }

                        // Prefer the category where this tool is registered in toolIds
                        const toolCategory = this.toolToCategory.get(toolName) || category;
                        if (!toolIds[toolCategory]?.includes(toolName)) {
                            return;
                        }

                        // Only process if it matches the requested category
                        if (toolCategory !== propertyKey) {
                            return;
                        }
                        
                        // Found palace mesh

                        // Parse mesh name parts for button text
                        const normalized = meshName.replace(/[._\s]/g, '_');
                        const firstNamePart = normalized.split('_')[0];
                        const secondNamePart = normalized.split('_')[1] || '';


                        // Store mesh (prefer canonical House_Blue / House_Red / House_Purple)
                        const existingMesh = modelsObj[propertyKey][toolName];
                        if (existingMesh) {
                            const curPri = this._houseMeshPriority(existingMesh.name, toolName);
                            const newPri = this._houseMeshPriority(meshName, toolName);
                            if (newPri <= curPri) {
                                return;
                            }
                        }

                        modelsObj[propertyKey][toolName] = child;
                        const isNewTool = !assetNames.includes(toolName);
                        if (isNewTool) {
                            assetNames.push(toolName);
                        }

                        // Add to button data (once per tool)
                        if (isNewTool) {
                            buttonData.push({
                                text: `${firstNamePart} ${secondNamePart}`,
                                tool: toolName,
                                group: firstNamePart
                            });
                        }

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

