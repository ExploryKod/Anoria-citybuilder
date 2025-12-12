import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { textures } from './data.js';
import MeshLoader from "./MeshLoaderOptimized.js";
import config from '../game/config.js';
import instancingManager from './InstancingManager.js';

/**
 * Gets the base URL for assets (similar to simcity's pattern)
 * Tries to read from Vite config, falls back to config.js value
 * @returns {string} Base URL
 */
function getAssetBaseUrl() {
    // Try to get from Vite config if available (like simcity does)
    try {
        // In Vite, import.meta.url or import.meta.env can provide base
        // For now, use config value - can be enhanced to read from vite.config.js
        return config.assets.baseUrl;
    } catch (e) {
        // Fallback to config
        return config.assets.baseUrl || '/';
    }
}

class AssetManager extends MeshLoader {
    #geometry = new THREE.BoxGeometry(1, 1, 1);
    #assets = {};
    #modelPath = "";
    #baseUrl = '';
    #loadingPromises = [];
    #isLoaded = false;
    #onLoadCallback = null;
    #meshUserData = {
        id: "nothing",
        type: "nothing",
        name: "nothing",
        neighbors: [],
        pop: 0,
        stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
        time: 0,
        isBuilding: false,
        roads: 0,
        stage: 0,
        stageName: "",
        price: 0,
        cityFunds: 0,
        maintenance: 0,
        worldTime: 0
    }
    
    // Shared materials for terrain - created once and reused to avoid texture unit limit
    #sharedTerrainMaterials = null;
    
    // Shared sprite materials - created once per texture type to avoid texture unit limit
    #sharedSpriteMaterials = new Map();

    /**
     * @param {Function} onLoad - Optional callback when all assets are loaded (similar to simcity)
     */
    constructor(onLoad = null) {
        super()
        this.#baseUrl = getAssetBaseUrl();
        // Standardize model path using base URL
        this.#modelPath = `${this.#baseUrl}resources/lowpoly/village_town_assets_v2.glb`.replace('//', '/');
        this.#onLoadCallback = onLoad;
        
        // Track loading state
        this.#isLoaded = false;
        this.#loadingPromises = [];
    }

    /**
     * Gets the base URL for asset paths
     * @returns {string}
     */
    getBaseUrl() {
        return this.#baseUrl;
    }

    /**
     * Builds a full asset URL from a relative path
     * @param {string} relativePath - Relative path from assets root
     * @returns {string} Full URL
     */
    getAssetUrl(relativePath) {
        // Remove leading slash if present, then combine with baseUrl
        const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
        return `${this.#baseUrl}${cleanPath}`.replace(/\/+/g, '/');
    }

    /**
     * Checks if all assets are loaded
     * @returns {boolean}
     */
    isLoaded() {
        return this.#isLoaded;
    }

    /**
     * Returns a promise that resolves when all assets are loaded
     * @returns {Promise<void>}
     */
    async waitForLoad() {
        if (this.#isLoaded) {
            return Promise.resolve();
        }
        return Promise.all(this.#loadingPromises);
    }

    getButtonData() {
        return this.buttonData
    }

    getToolIds() {
        return this.toolIds
    }
    
    // Public method to get shared terrain materials (for updating terrain meshes)
    getSharedTerrainMaterials() {
        return this.#getSharedTerrainMaterials();
    }

    /**
     * @param {string|number} name
     * @param {string|number|symbol} group
     * @param modelsObj
     */
    #isObject3DByName(name, group, modelsObj) {
        if(Object.hasOwn(modelsObj, group)) {
            let mesh = modelsObj[group];
            // Checking mesh availability
            if(mesh[name]?.isObject3D) {
                mesh = modelsObj[group][name].clone();
                return mesh;
            } else {
                console.warn('this is not a mesh: ', mesh);
                return false;
            }

        }
        return false;
    }

    #isObject3DByMesh(mesh) {
        if(Object.hasOwn(mesh, 'isObject3D')) {

            if(!mesh.isObject3D) {
                console.error('this is not a mesh object3D: ', mesh);
                return false;
            } else {
                return true;
            }

        } else {
            console.error('this object has no Object3D property: ', mesh);
            return false;
        }
    }

    changeMeshColor(mesh, color) {

        if(!Object.hasOwn(mesh, 'isObject3D')) {
            console.error('this is not a mesh object3D: ', mesh);
        }

        mesh.traverse(obj => {
            if (obj.material) {
                obj.material = obj.material.clone();
                obj.material = new THREE.MeshLambertMaterial({ color });
                obj.receiveShadow = true;
                obj.castShadow = true;
            }
        });
    }

    /**
     * Handles any clean up needed before an object is removed
     */
    dispose(mesh) {

        if(this.#isObject3DByMesh(mesh)) {
            mesh.traverse((obj) => {
                if (obj.material) {
                    obj.material?.dispose();
                }
            })
        }
    }

    cloneMeshMaterial(mesh) {

        if(!this.#isObject3DByMesh()) {
            console.warn('this is not a mesh object3D: ', mesh);
            return null
        }

        if(this.#isObject3DByMesh(mesh)) {
            mesh.traverse((obj) => {
                if(obj.material) {
                    obj.material = obj.material.clone();
                } else {
                    console.warn('no material found here: ', obj);
                }
            });
        }

    }

    #createBuilding(x, y, z, size, meshName, objectsData) {
        // Creating building
        const placerPos = new THREE.Vector3(x, y, z);
        
        // For road variants, use the base StonePath-001 mesh
        let sourceMeshName = meshName;
        if (meshName.startsWith('StonePath-') && meshName !== 'StonePath-001') {
            sourceMeshName = 'StonePath-001';
        }
        
        const sourceObject = objectsData[sourceMeshName];
        
        // Clone the object
        const object3D = sourceObject.clone();
        
        // CRITICAL: Restore original materials from source to avoid cloning materials
        // This prevents exceeding WebGL texture unit limit (32 max)
        // We traverse both objects in the same order and match materials
        const sourceMeshes = [];
        const clonedMeshes = [];
        
        sourceObject.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                sourceMeshes.push(child);
            }
        });
        
        object3D.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                clonedMeshes.push(child);
            }
        });
        
        // Match materials by traversal order (same structure)
        // Also handle material arrays (for multi-material meshes)
        for (let i = 0; i < clonedMeshes.length && i < sourceMeshes.length; i++) {
            const sourceMesh = sourceMeshes[i];
            const clonedMesh = clonedMeshes[i];
            
            if (sourceMesh.material) {
                if (Array.isArray(sourceMesh.material)) {
                    // Handle material arrays
                    clonedMesh.material = sourceMesh.material;
                } else {
                    // Single material
                    clonedMesh.material = sourceMesh.material;
                }
            }
        }

        object3D.name = `${meshName}`;
        // Position assets above the World platform (World is at y = 0.2)
        // Buildings should be on top of the World, so we add an offset
        // Roads (StonePath) should be positioned like other buildings (houses, etc.)
        const worldPlatformHeight = 0.2;
        // All assets (including roads) use the same positioning formula
        const yOffset = placerPos.z + worldPlatformHeight;
        object3D.position.set(placerPos.x, yOffset, placerPos.y);
        object3D.scale.set(size, size, size);
        
        // Apply different rotations for road variants
        // We rotate on Z axis to keep roads flat on the ground
        let rotationZ = 180; // Default rotation for straight road
        if (meshName === 'StonePath-Right-001') {
            rotationZ = 270; // 90° clockwise turn (right)
        } else if (meshName === 'StonePath-Left-001') {
            rotationZ = 90; // 90° counter-clockwise turn (left)
        } else if (meshName === 'StonePath-Cross-001') {
            rotationZ = 180; // Crossroad (same as straight)
        }
        
        object3D.rotation.set(
            THREE.MathUtils.degToRad(90),  // X: keeps road horizontal
            THREE.MathUtils.degToRad(180), // Y: base orientation
            THREE.MathUtils.degToRad(rotationZ) // Z: rotation for turns (keeps road flat)
        );



        // For StonePath variants, mark them as roads for neighbor detection and road logic
        // BUT keep isBuilding: true so they render like other buildings
        const isRoad = meshName.startsWith('StonePath-');
        
        // Set mesh.name to 'roads' for compatibility with existing checks like mesh.name === 'roads'
        if (isRoad) {
            object3D.name = 'roads';
        }
        
        object3D.userData = {
            id: meshName, 
            type: meshName,  // Use exact meshName for all buildings (including roads) - matches city.tiles.buildingId pattern
            name: meshName,  // Also in userData for consistency
            isBuilding: true,  // Keep as building for visibility/rendering
            isRoad: isRoad,  // Mark roads for road logic detection 
            x, 
            y,
            neighbors: [],
            pop: 0,
            stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
            time: 0,
            roads: 0,
            stage: 0,
            stageName: "",
            price: 0,
            cityFunds: 0,
            maintenance: 0,
            worldTime: 0
        };

        return object3D;
    }

    // Initialize shared terrain materials (called once, reused for all tiles)
    #getSharedTerrainMaterials() {
        if (!this.#sharedTerrainMaterials) {
            // Vérifier que les textures sont chargées
            if (!textures['roads'] || !textures['grass']) {
                console.error('[AssetManager] Textures not loaded yet!', { 
                    roads: !!textures['roads'], 
                    grass: !!textures['grass'] 
                });
            }
            
            // Create shared materials once - these will be reused for all terrain tiles
            // This prevents exceeding WebGL texture unit limit (32 max)
            // NOTE: Removed specularMap to save texture units (not critical for visual quality)
            this.#sharedTerrainMaterials = {
                'roads': new THREE.MeshLambertMaterial({
                    map: textures['roads'],
                    // S'assurer que la texture est correctement configurée
                    transparent: false,
                    side: THREE.FrontSide
                }),
                'grass': new THREE.MeshLambertMaterial({
                    // map: textures['grass'],  // Texture commented out - using solid color instead
                    color: 0x6DB973,  // Match world platform color #6DB973
                    transparent: false,
                    side: THREE.FrontSide
                }),
                'terrain': new THREE.MeshLambertMaterial({
                    // map: textures['grass'],
                    color: 0x6DB973,
                    emissive: 0x220000,
                    transparent: false,
                    side: THREE.FrontSide
                })
            };
            
            // S'assurer que les textures sont marquées pour mise à jour
            if (this.#sharedTerrainMaterials['roads'].map) {
                this.#sharedTerrainMaterials['roads'].map.needsUpdate = true;
            }
            if (this.#sharedTerrainMaterials['grass'].map) {
                this.#sharedTerrainMaterials['grass'].map.needsUpdate = true;
            }
        }
        return this.#sharedTerrainMaterials;
    }

    #createTerrain(x, y, buildingId = '') {
        let mesh;
        let material;

        // Use shared materials instead of creating new ones each time
        const materials = this.#getSharedTerrainMaterials();

        // World platform is at y = 0.2
        const worldPlatformHeight = 0.2;
        
        switch (buildingId) {
            case 'roads':
                material = materials['roads'];
                // Use a flat plane geometry for roads instead of a cube
                // This makes them visible as a flat surface above the World platform
                const roadGeometry = new THREE.PlaneGeometry(1, 1);
                mesh = new THREE.Mesh(roadGeometry, material);
                mesh.userData = { id: buildingId, x, y, isBuilding: false, isRoad: true, time: 0 };
                mesh.name = buildingId;
                // Rotate the plane to be horizontal (lying flat on the ground)
                mesh.rotation.x = -Math.PI / 2; // Rotate 90 degrees to lay flat
                // Position well above grass - grass top is at (worldPlatformHeight - 0.48) + 0.5 = -0.28 + 0.5 = 0.22
                // Set roads higher to be clearly elevated above grass
                mesh.position.set(x, worldPlatformHeight + 0.5, y); // 0.2 + 0.5 = 0.7 (well above grass at ~0.22)
                mesh.castShadow = false; // Planes don't cast shadows well
                mesh.receiveShadow = true;
                break;


            case 'grass':
                material = materials['grass'];
                mesh = new THREE.Mesh(this.#geometry, material);
                mesh.name = buildingId;
                mesh.userData = { id: buildingId, x, y, isBuilding: false, time: 0 };
                mesh.scale.set(1, 1, 1);
                // Grass terrain below the World platform
                mesh.position.set(x, worldPlatformHeight - 0.48, y);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                break;

            case 'terrain':
                material = materials['terrain'] || materials['grass'];
                mesh = new THREE.Mesh(this.#geometry, material);
                mesh.name = buildingId;
                mesh.userData = { id: buildingId, x, y, isBuilding: false, isPlaceholder: true, time: 0 };
                mesh.scale.set(1, 1, 1);
                // Terrain below the World platform
                mesh.position.set(x, worldPlatformHeight - 0.4, y);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                break;

            default:
                // Default terrain choice
        }

        return mesh;
    }

    #getModelsObj(type) {
        switch(type) {
            case 'houses':
                return this.modelsObj['houses'];
            case 'farms':
                return this.modelsObj['farms'];
            case 'industry':
                return this.modelsObj['industry'];
            case 'markets':
                return this.modelsObj['markets'];
            case 'infrastructure':
                return this.modelsObj['infrastructure'];
            case 'public':
                return this.modelsObj['public'];
            case 'palaces':
                return this.modelsObj['palaces'];
            case 'nature':
                return this.modelsObj['nature'];
            default:
                throw new Error(`Unknown model type: ${type}`);
        }
    }

    async initializeTerrains() {

        // Zones (only grass now, roads are 3D meshes)
        this.toolIds.zones.forEach(toolId => {
            this.#assets[toolId] = (x, y) => this.#createTerrain(x, y, toolId);
        });
    }

    async initializeBuildings(propertyKey) {

        if(Object.hasOwn(this.modelMetas, propertyKey) && Object.hasOwn(this.toolIds, propertyKey)) {
            if (propertyKey === 'public') {
                // Public category has Church-002 from main GLB and BookShop-001 as standalone (autonomous button)
                // Load main GLB assets first (Church-002)
                const loadMainPromise = this.loadAssets(this.assetFullName, propertyKey, this.modelsObj, this.allAssetsNames, this.assetNames, this.toolIds, this.buttonData);
                this.#loadingPromises.push(loadMainPromise);
                await loadMainPromise;
                
                // Then load BookShop-001 as standalone for autonomous button
                const loadBookShopPromise = this.#loadStandaloneGLB('bookshop');
                this.#loadingPromises.push(loadBookShopPromise);
                await loadBookShopPromise;
            } else if (propertyKey === 'industry') {
                // Industry category has assets from main GLB and Winery-001 as standalone (autonomous button)
                // Load main GLB assets first (Windmill-001, Barn-001, Crate-001)
                const loadMainPromise = this.loadAssets(this.assetFullName, propertyKey, this.modelsObj, this.allAssetsNames, this.assetNames, this.toolIds, this.buttonData);
                this.#loadingPromises.push(loadMainPromise);
                await loadMainPromise;
                
                // Then load Winery-001 as standalone for autonomous button
                const loadWineryPromise = this.#loadStandaloneGLB('winery');
                this.#loadingPromises.push(loadWineryPromise);
                await loadWineryPromise;
            } else {
                // Track loading promise for completion signaling
                const loadPromise = this.loadAssets(this.assetFullName, propertyKey, this.modelsObj, this.allAssetsNames, this.assetNames, this.toolIds, this.buttonData);
                this.#loadingPromises.push(loadPromise);
                
                await loadPromise;
            }
            
            // Houses
            this.toolIds[propertyKey].forEach(toolId => {
                // Check for per-asset size override, otherwise use category size
                const size = this.assetSizeOverrides?.[toolId] ?? this.modelMetas[propertyKey].size;
                this.#assets[toolId] = (x, y, z = 0) =>
                    this.#createBuilding(x, y, z, size, toolId, this.#getModelsObj(propertyKey));
            });
            
            // Special handling: Create road variants (Right, Left, Cross) that use StonePath-001 mesh
            // These are virtual assets that reuse the same mesh with different rotations
            if (propertyKey === 'infrastructure' && this.toolIds[propertyKey].includes('StonePath-001')) {
                const size = this.assetSizeOverrides?.['StonePath-001'] ?? this.modelMetas[propertyKey].size;
                const modelsObj = this.#getModelsObj(propertyKey);
                
                // Create variants that will use StonePath-001 mesh but with different rotations
                this.#assets['StonePath-Right-001'] = (x, y, z = 0) =>
                    this.#createBuilding(x, y, z, size, 'StonePath-Right-001', modelsObj);
                this.#assets['StonePath-Left-001'] = (x, y, z = 0) =>
                    this.#createBuilding(x, y, z, size, 'StonePath-Left-001', modelsObj);
                this.#assets['StonePath-Cross-001'] = (x, y, z = 0) =>
                    this.#createBuilding(x, y, z, size, 'StonePath-Cross-001', modelsObj);
                
                // Add button data for road variants
                this.buttonData.push({
                    text: 'StonePath Right',
                    tool: 'StonePath-Right-001',
                    group: 'StonePath'
                });
                this.buttonData.push({
                    text: 'StonePath Left',
                    tool: 'StonePath-Left-001',
                    group: 'StonePath'
                });
                this.buttonData.push({
                    text: 'StonePath Cross',
                    tool: 'StonePath-Cross-001',
                    group: 'StonePath'
                });
            }
            
            // Check if all loading is complete asynchronously (fires after all promises resolve)
            // Note: This is called after each building category loads, but will only fire callback once all complete
            this.#checkLoadingComplete();
        } else {
            console.warn(`Unknown property property type ${propertyKey}`);
        }
    }

    /**
     * Load standalone GLB files (like winery_v3.glb, book_shop.glb) that are not in the main asset file
     * @param {string} propertyKey - The category key (e.g., 'workshop') or 'bookshop' for autonomous button
     * @returns {Promise<void>}
     */
    async #loadStandaloneGLB(propertyKey) {
        return new Promise((resolve, reject) => {
            const gltfloader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/examples/jsm/libs/draco/');
            gltfloader.setDRACOLoader(dracoLoader);

            // Map of tool IDs to their GLB file paths
            const standaloneAssets = {
                'Winery-001': './resources/lowpoly/winery_v3.glb',
                'BookShop-001': './resources/lowpoly/bookshop_v1.glb'
            };

            // Handle special cases for autonomous buttons (bookshop, winery)
            let toolIds;
            let targetPropertyKey = propertyKey;
            if (propertyKey === 'bookshop') {
                toolIds = ['BookShop-001'];
                targetPropertyKey = 'public'; // Store in public modelsObj but as standalone
            } else if (propertyKey === 'winery') {
                toolIds = ['Winery-001'];
                targetPropertyKey = 'industry'; // Store in industry modelsObj but as standalone
            } else {
                toolIds = this.toolIds[propertyKey] || [];
            }

            const loadPromises = [];

            toolIds.forEach(toolId => {
                const glbPath = standaloneAssets[toolId];
                if (!glbPath) {
                    // Skip if no standalone GLB path (asset might be in main GLB file)
                    return;
                }

                const loadPromise = new Promise((resolveAsset, rejectAsset) => {
                    gltfloader.load(
                        glbPath,
                        (gltf) => {
                            // Find the main mesh in the GLB file
                            let mainMesh = null;
                            
                            gltf.scene.traverse((child) => {
                                if (child instanceof THREE.Mesh && !mainMesh) {
                                    // Use the first mesh found, or you can search for a specific name
                                    mainMesh = child;
                                }
                            });

                            // If no mesh found, use the scene itself
                            if (!mainMesh && gltf.scene) {
                                mainMesh = gltf.scene;
                            }

                            if (mainMesh) {
                                // Apply standard rotation like other assets
                                mainMesh.rotation.set(
                                    THREE.MathUtils.degToRad(90),
                                    THREE.MathUtils.degToRad(180),
                                    THREE.MathUtils.degToRad(180)
                                );

                                // Enable shadows
                                mainMesh.traverse((obj) => {
                                    if (obj instanceof THREE.Mesh) {
                                        obj.castShadow = true;
                                        obj.receiveShadow = true;
                                        
                                        // Convert materials to MeshLambertMaterial for proper lighting
                                        if (obj.material) {
                                            if (obj.material instanceof THREE.MeshBasicMaterial) {
                                                const newMaterial = new THREE.MeshLambertMaterial({
                                                    map: obj.material.map,
                                                    color: obj.material.color,
                                                    transparent: obj.material.transparent,
                                                    opacity: obj.material.opacity
                                                });
                                                obj.material = newMaterial;
                                            }
                                        }
                                    }
                                });

                                // Store the mesh
                                this.modelsObj[targetPropertyKey][toolId] = mainMesh;
                                
                                // Winery-001 and BookShop-001 are autonomous buttons, so we don't add them to buttonData

                                // Add to asset array
                                const assetArray = this.allAssetsNames.find(a => a[targetPropertyKey]);
                                if (assetArray) {
                                    assetArray[targetPropertyKey].push({
                                        fullName: toolId,
                                        name: toolId,
                                        mesh: mainMesh
                                    });
                                }
                                
                                // Create the asset function for placement
                                const size = this.assetSizeOverrides?.[toolId] ?? this.modelMetas[targetPropertyKey].size;
                                this.#assets[toolId] = (x, y, z = 0) =>
                                    this.#createBuilding(x, y, z, size, toolId, this.#getModelsObj(targetPropertyKey));

                                console.log(`[AssetManager] Loaded standalone asset: ${toolId} from ${glbPath}`);
                                resolveAsset();
                            } else {
                                console.error(`[AssetManager] No mesh found in ${glbPath}`);
                                rejectAsset(new Error(`No mesh found in ${glbPath}`));
                            }
                        },
                        (xhr) => {
                            // Progress callback
                        },
                        (error) => {
                            console.error(`[AssetManager] Error loading ${glbPath}:`, error);
                            rejectAsset(error);
                        }
                    );
                });

                loadPromises.push(loadPromise);
            });

            // Wait for all standalone assets to load
            if (loadPromises.length === 0) {
                resolve();
            } else {
                Promise.all(loadPromises)
                    .then(() => {
                        resolve();
                    })
                    .catch((error) => {
                        console.error('[AssetManager] Error loading standalone GLB files:', error);
                        reject(error);
                    });
            }
        });
    }

    /**
     * Marks assets as loaded and calls onLoad callback if provided
     * Similar to simcity's AssetManager pattern
     * Checks completion asynchronously to ensure all promises are resolved
     */
    async #checkLoadingComplete() {
        if (this.#loadingPromises.length === 0) {
            // No async loading, mark as loaded immediately
            if (!this.#isLoaded) {
                this.#isLoaded = true;
                if (this.#onLoadCallback) {
                    this.#onLoadCallback();
                }
            }
            return;
        }

        // Wait for all promises to complete
        try {
            await Promise.all(this.#loadingPromises);
            if (!this.#isLoaded) {
                this.#isLoaded = true;
                if (this.#onLoadCallback) {
                    this.#onLoadCallback();
                }
            }
        } catch (error) {
            console.error('Asset loading failed:', error);
        }
    }

    createAsset(assetId, x, y) {
        if (assetId in this.#assets) {
            return this.#assets[assetId](x, y);
        } else {
            console.warn(`[AssetManager] Asset ${assetId} does not exist`);
            return undefined;
        }
    }

    /**
     * Load the base world platform (World_Material005_0) and add it to the scene
     * This is called once at scene initialization
     * @param {THREE.Scene} scene - The Three.js scene to add the world platform to
     * @param {number} citySize - Size of the city (number of tiles) to scale the World platform accordingly
     * @returns {Promise<THREE.Object3D>} The loaded world platform mesh
     */
    async loadWorldPlatform(scene, citySize = 16) {
        return new Promise((resolve, reject) => {
            const gltfloader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/examples/jsm/libs/draco/');
            gltfloader.setDRACOLoader(dracoLoader);

            const modelPath = `./resources/lowpoly/village_town_assets_v2.glb`;
            
            gltfloader.load(
                modelPath,
                (gltf) => {
                    let worldMesh = null;
                    
                    // Traverse the scene to find World_Material005_0
                    gltf.scene.traverse((child) => {
                        if (child instanceof THREE.Mesh && child.name === 'World_Material005_0') {
                            // Clone the mesh
                            worldMesh = child.clone();
                            worldMesh.name = 'world-platform';
                            
                            // Apply the same rotation as all other assets to match the scene orientation
                            // All buildings use: rotation.set(90deg X, 180deg Y, 180deg Z)
                            // This ensures the World platform is horizontal like the terrain (grass)
                            worldMesh.rotation.set(
                                THREE.MathUtils.degToRad(90),
                                THREE.MathUtils.degToRad(180),
                                THREE.MathUtils.degToRad(180)
                            );
                            
                            // Get the original bounding box BEFORE scaling and positioning
                            // This gives us the original size of the World mesh in the GLB
                            const originalBbox = new THREE.Box3().setFromObject(worldMesh);
                            const originalWorldSize = Math.max(
                                originalBbox.max.x - originalBbox.min.x,
                                originalBbox.max.z - originalBbox.min.z
                            );
                            
                            // Scale to match city size (with large margin for extended circumference)
                            // Each tile is 1 unit, so citySize tiles = citySize units
                            // Add large margin to extend World platform well beyond city boundaries
                            const margin = Math.max(citySize * 0.5, 20); // Large margin: 50% of city size or minimum 20 units
                            const targetSize = citySize + (margin * 2); // margin on each side
                            const scaleFactor = originalWorldSize > 0 ? targetSize / originalWorldSize : 1;
                            worldMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
                            
                            // Position and center the World at the city center
                            // Roads are at y = 0.21 (just above World at 0.2), so we place World at 0.2
                            const worldPlatformHeight = 0.2;
                            const cityCenter = citySize / 2;
                            worldMesh.position.set(cityCenter, worldPlatformHeight, cityCenter);
                            
                            // Make it visible and ensure it's not too small
                            worldMesh.visible = true;
                            
                            // Make it non-interactive (not part of raycasting)
                            worldMesh.userData = {
                                isWorldPlatform: true,
                                nonInteractive: true
                            };
                            
                            // Add to scene
                            scene.add(worldMesh);
                            
                            // Log final state
                            const bbox = new THREE.Box3().setFromObject(worldMesh);
                            console.info('[AssetManager] World platform loaded and added to scene:', {
                                position: worldMesh.position,
                                rotation: worldMesh.rotation,
                                scale: worldMesh.scale,
                                boundingBox: bbox,
                                visible: worldMesh.visible
                            });
                        }
                    });
                    
                    if (worldMesh) {
                        resolve(worldMesh);
                    } else {
                        console.warn('[AssetManager] World_Material005_0 not found in GLB file');
                        resolve(null);
                    }
                },
                undefined,
                (error) => {
                    console.error('[AssetManager] Error loading world platform:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Load and position fences at the scene boundaries (north, south, east, west)
     * @param {THREE.Scene} scene - The Three.js scene
     * @param {number} citySize - The size of the city (boundaries will be at 0 and citySize)
     * @returns {Promise<void>}
     */
    async loadBoundaryFences(scene, citySize = 16) {
        return new Promise((resolve, reject) => {
            const gltfloader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/examples/jsm/libs/draco/');
            gltfloader.setDRACOLoader(dracoLoader);

            const modelPath = `./resources/lowpoly/village_town_assets_v2.glb`;
            
            gltfloader.load(
                modelPath,
                (gltf) => {
                    // Find fence models in the GLB file
                    // Common fence names might be: Fence, Fence-001, Fence_001, etc.
                    const fenceModels = [];
                    
                    gltf.scene.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            const name = child.name.toLowerCase();
                            // Check if this is a fence model (handle various naming conventions)
                            // Common patterns: "fence", "Fence", "Fence_001", "Fence-001", etc.
                            if (name.includes('fence') || name.includes('barrier') || name.includes('wall')) {
                                fenceModels.push(child);
                            }
                        }
                    });

                    if (fenceModels.length === 0) {
                        console.warn('[AssetManager] No fence models found in GLB file');
                        resolve();
                        return;
                    }

                    // Use the first fence model found (or you can use a specific one)
                    const fenceTemplate = fenceModels[0];
                    
                    // Get fence bounding box to determine its size
                    const fenceBbox = new THREE.Box3().setFromObject(fenceTemplate);
                    const fenceLength = Math.max(
                        fenceBbox.max.x - fenceBbox.min.x,
                        fenceBbox.max.z - fenceBbox.min.z
                    );

                    // Calculate how many fence segments we need for each side
                    // Each fence segment should be approximately 1 unit (1 tile)
                    const fenceSegmentLength = fenceLength > 0 ? fenceLength : 1;
                    const fenceSpacing = 2; // Spacing between fence segments (in units/tiles)
                    const segmentWithSpacing = fenceSegmentLength + fenceSpacing;
                    const segmentsPerSide = Math.ceil(citySize / segmentWithSpacing);

                    // Position offset: place fences at the terrain boundaries
                    // Terrain boundaries are from 0 to citySize (buildable area)
                    // Place fences slightly outside (0.1 units) to mark the boundary clearly
                    const boundaryOffset = 0.1;
                    const fenceHeight = 0.5; // Height above ground (adjust as needed)

                    // Create a group for all fences
                    const fenceGroup = new THREE.Group();
                    fenceGroup.name = 'boundary-fences';

                    // Rotations for north and south fences to stand upright (vertical)
                    // North fence: runs along X-axis, faces north (positive Z)
                    const northRotationX = THREE.MathUtils.degToRad(90);
                    const northRotationY = THREE.MathUtils.degToRad(0);
                    const northRotationZ = THREE.MathUtils.degToRad(0);
                    
                    // South fence: runs along X-axis, faces south (negative Z) - rotated 180° from north
                    const southRotationX = THREE.MathUtils.degToRad(90);
                    const southRotationY = THREE.MathUtils.degToRad(180);
                    const southRotationZ = THREE.MathUtils.degToRad(0);

                    // North fence (z = citySize) - runs along x-axis from 0 to citySize
                    for (let i = 0; i < segmentsPerSide; i++) {
                        const fence = fenceTemplate.clone();
                        fence.rotation.set(northRotationX, northRotationY, northRotationZ);
                        const xPos = (i * segmentWithSpacing) + (fenceSegmentLength / 2);
                        // Clamp to ensure we don't go beyond citySize
                        if (xPos <= citySize) {
                            fence.position.set(xPos, fenceHeight, citySize + boundaryOffset);
                            fence.userData = {
                                isBoundaryFence: true,
                                nonInteractive: true,
                                side: 'north'
                            };
                            fenceGroup.add(fence);
                        }
                    }

                    // South fence (z = 0) - runs along x-axis from 0 to citySize
                    for (let i = 0; i < segmentsPerSide; i++) {
                        const fence = fenceTemplate.clone();
                        fence.rotation.set(southRotationX, southRotationY, southRotationZ);
                        const xPos = (i * segmentWithSpacing) + (fenceSegmentLength / 2);
                        // Clamp to ensure we don't go beyond citySize
                        if (xPos <= citySize) {
                            fence.position.set(xPos, fenceHeight, 0 - boundaryOffset);
                            fence.userData = {
                                isBoundaryFence: true,
                                nonInteractive: true,
                                side: 'south'
                            };
                            fenceGroup.add(fence);
                        }
                    }


                    // Add fence group to scene
                    scene.add(fenceGroup);

                    resolve();
                },
                undefined,
                (error) => {
                    console.error('[AssetManager] Error loading boundary fences:', error);
                    reject(error);
                }
            );
        });
    }

    setSprite(texture = textures['no-roads'], name) {
        // Use shared sprite materials to avoid texture unit limit
        // Create a key based on texture UUID to identify unique materials
        const textureKey = texture.uuid || 'default';
        
        // Get or create shared material for this texture
        if (!this.#sharedSpriteMaterials.has(textureKey)) {
            // Create a clone of the texture for sprites (to set flipY without affecting original)
            // But share the material itself to save texture units
            const spriteTexture = texture.clone();
            spriteTexture.flipY = true; // Ensure sprites display correctly
            
            const spriteMaterial = new THREE.SpriteMaterial({
                map: spriteTexture,
                depthTest: false,
                transparent: true,
                alphaTest: 0.5
            });
            this.#sharedSpriteMaterials.set(textureKey, spriteMaterial);
        }
        
        const spriteMaterial = this.#sharedSpriteMaterials.get(textureKey);
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.name = name;
        return sprite;
    }

    setStatusSprite(mesh, texture, name, scale = {x: 0.7, y: 0.7, z: 1}, position, visible = false, color = null, backgroundColor = null) {
        // Remove existing sprite with the same name first
        this.removeStatusSprite(mesh, name);
        
        // If background color is specified, this is a farm season sprite
        // Remove ALL existing farm sprites to prevent overlapping between seasons
        if (backgroundColor !== null) {
            const farmSpriteNames = ['grow-food', 'harvest', 'sell-food', 'no-work',
                                     'grow-food-bg', 'harvest-bg', 'sell-food-bg', 'no-work-bg'];
            farmSpriteNames.forEach(spriteName => {
                this.removeStatusSprite(mesh, spriteName);
            });
        }
        
        // Also clean up farm sprites if this is a farm winter sprite (no-food with red color)
        // or a no-work sprite (farm has no employees)
        if ((name === 'no-food' && color === 0xff0000) || name === 'no-work') {
            const farmSpriteNames = ['grow-food', 'harvest', 'sell-food', 'no-work',
                                     'grow-food-bg', 'harvest-bg', 'sell-food-bg', 'no-work-bg'];
            farmSpriteNames.forEach(spriteName => {
                this.removeStatusSprite(mesh, spriteName);
            });
        }
        
        // If background color is specified, create a colored circular background sprite first
        if (backgroundColor !== null) {
            const bgSprite = this.setSpriteWithColoredBackground(name + '-bg', scale, backgroundColor);
            bgSprite.position.set(position.x, position.y, position.z - 0.01); // Slightly behind the main sprite
            bgSprite.visible = visible;
            mesh.add(bgSprite);
        }
        
        // If color is specified, create a sprite with colored material
        let sprite;
        if (color) {
            sprite = this.setSpriteWithColor(texture, name, color);
        } else {
            sprite = this.setSprite(texture, name);
        }
        
        sprite.scale.set(scale.x, scale.y, scale.z);
        sprite.position.set(position.x, position.y, position.z);
        sprite.visible = visible;
        mesh.add(sprite);
    }
    
    /**
     * Creates a colored circular background sprite (slightly larger than the icon sprite)
     * @param {string} name - Name for the sprite
     * @param {Object} iconScale - Scale of the icon sprite to make background slightly larger
     * @param {string|number} backgroundColor - Color for the background (hex string like '#FFB6C1' or number like 0xFFB6C1)
     * @returns {THREE.Sprite} Created colored circular background sprite
     */
    setSpriteWithColoredBackground(name, iconScale, backgroundColor) {
        // Convert color to hex string if it's a number
        let colorHex = backgroundColor;
        if (typeof backgroundColor === 'number') {
            colorHex = '#' + backgroundColor.toString(16).padStart(6, '0');
        } else if (typeof backgroundColor === 'string' && backgroundColor.startsWith('0x')) {
            colorHex = '#' + backgroundColor.substring(2);
        }
        
        // Create a colored circular texture using Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Draw a colored circle
        ctx.fillStyle = colorHex;
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2); // Center at (32,32), radius 30
        ctx.fill();
        
        const coloredTexture = new THREE.CanvasTexture(canvas);
        coloredTexture.flipY = true;
        
        // Use a unique key for caching based on color
        const colorKey = typeof backgroundColor === 'string' ? backgroundColor : backgroundColor.toString();
        const textureKey = `bg_${colorKey}`;
        
        // Cache the material to avoid recreating it
        if (!this.#sharedSpriteMaterials.has(textureKey)) {
            const bgMaterial = new THREE.SpriteMaterial({
                map: coloredTexture,
                depthTest: false,
                transparent: true,
                opacity: 0.9 // Slightly transparent
            });
            this.#sharedSpriteMaterials.set(textureKey, bgMaterial);
        }
        
        const bgMaterial = this.#sharedSpriteMaterials.get(textureKey);
        const bgSprite = new THREE.Sprite(bgMaterial);
        bgSprite.name = name;
        // Make background sprite much larger to completely wrap the icon (150% of icon size)
        bgSprite.scale.set(iconScale.x * 1.5, iconScale.y * 1.5, iconScale.z);
        
        return bgSprite;
    }
    
    /**
     * Creates a sprite with a colored material (for custom tinting)
     * @param {THREE.Texture} texture - Texture to use
     * @param {string} name - Name for the sprite
     * @param {THREE.Color|number|string} color - Color to tint the sprite (red, 0xff0000, etc.)
     * @returns {THREE.Sprite} Created sprite
     */
    setSpriteWithColor(texture, name, color) {
        // Create a unique key that includes the color to avoid sharing colored materials
        const colorKey = typeof color === 'string' ? color : (typeof color === 'number' ? `0x${color.toString(16)}` : color.getHexString());
        const textureKey = `${texture.uuid || 'default'}_${colorKey}`;
        
        // Get or create shared material for this texture+color combination
        if (!this.#sharedSpriteMaterials.has(textureKey)) {
            const spriteTexture = texture.clone();
            spriteTexture.flipY = true;
            
            const spriteMaterial = new THREE.SpriteMaterial({
                map: spriteTexture,
                color: color, // Apply color tint
                depthTest: false,
                transparent: true,
                alphaTest: 0.5
            });
            this.#sharedSpriteMaterials.set(textureKey, spriteMaterial);
        }
        
        const spriteMaterial = this.#sharedSpriteMaterials.get(textureKey);
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.name = name;
        return sprite;
    }

    removeStatusSprite(mesh, name) {
        // Remove both the main sprite and its background if it exists
        const existingSprite = mesh.children.find(
            child => child.type === "Sprite" && child.name === name
        );
        if (existingSprite) {
            mesh.remove(existingSprite);
            // Dispose of the sprite material to prevent memory leaks
            if (existingSprite.material) {
                existingSprite.material.dispose();
            }
        }
        
        // Also remove background sprite if it exists
        const existingBgSprite = mesh.children.find(
            child => child.type === "Sprite" && child.name === name + '-bg'
        );
        if (existingBgSprite) {
            mesh.remove(existingBgSprite);
            if (existingBgSprite.material) {
                existingBgSprite.material.dispose();
            }
        }
    }

    setNoRoadSprite(mesh, position, visible = false) {
        this.setStatusSprite(mesh, textures['no-roads'], 'no-road', {x: 0.6, y: 0.6, z: 1}, position, visible);
    }

    setNoFoodSprite(mesh, position, visible = false) {
        this.setStatusSprite(mesh, textures['nofood'], 'no-food', {x: 0.6, y: 0.6, z: 1}, position, visible);
    }
}

export default AssetManager;