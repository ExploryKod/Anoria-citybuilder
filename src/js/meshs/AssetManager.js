import * as THREE from 'three';
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
        const sourceObject = objectsData[meshName];
        
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
        object3D.position.set(placerPos.x, placerPos.z, placerPos.y);
        object3D.scale.set(size, size, size);
        object3D.rotation.set(
            THREE.MathUtils.degToRad(90),
            THREE.MathUtils.degToRad(180),
            THREE.MathUtils.degToRad(180)
        );



        object3D.userData = {
            id: meshName, 
            type: meshName, 
            name: meshName, 
            isBuilding: true, 
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
                    map: textures['grass'],
                    transparent: false,
                    side: THREE.FrontSide
                }),
                'terrain': new THREE.MeshLambertMaterial({
                    map: textures['grass'],
                    color: 0x8b1e1e,
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

        switch (buildingId) {
            case 'roads':
                material = materials['roads'];
                mesh = new THREE.Mesh(this.#geometry, material);
                mesh.userData = { id: buildingId, x, y, isBuilding: false, isRoad: true, time: 0 };
                mesh.name = buildingId;
                mesh.scale.set(1, 1, 1);
                mesh.position.set(x, -0.5, y);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                break;

            case 'grass':
                material = materials['grass'];
                mesh = new THREE.Mesh(this.#geometry, material);
                mesh.name = buildingId;
                mesh.userData = { id: buildingId, x, y, isBuilding: false, time: 0 };
                mesh.scale.set(1, 1, 1);
                mesh.position.set(x, -0.5, y);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                break;

            case 'terrain':
                material = materials['terrain'] || materials['grass'];
                mesh = new THREE.Mesh(this.#geometry, material);
                mesh.name = buildingId;
                mesh.userData = { id: buildingId, x, y, isBuilding: false, isPlaceholder: true, time: 0 };
                mesh.scale.set(1, 1, 1);
                mesh.position.set(x, -0.5, y);
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
            case 'decoration':
                return this.modelsObj['decoration'];
            default:
                throw new Error(`Unknown model type: ${type}`);
        }
    }

    async initializeTerrains() {

        // Zones
        this.toolIds.zones.forEach(toolId => {
            this.#assets[toolId] = (x, y) => this.#createTerrain(x, y, toolId);
        });
    }

    async initializeBuildings(propertyKey) {

        if(Object.hasOwn(this.modelMetas, propertyKey) && Object.hasOwn(this.toolIds, propertyKey)) {
            // Track loading promise for completion signaling
            const loadPromise = this.loadAssets(this.assetFullName, propertyKey, this.modelsObj, this.allAssetsNames, this.assetNames, this.toolIds, this.buttonData);
            this.#loadingPromises.push(loadPromise);
            
            await loadPromise;
            
            // Houses
            this.toolIds[propertyKey].forEach(toolId => {
                // Check for per-asset size override, otherwise use category size
                const size = this.assetSizeOverrides?.[toolId] ?? this.modelMetas[propertyKey].size;
                this.#assets[toolId] = (x, y, z = 0) =>
                    this.#createBuilding(x, y, z, size, toolId, this.#getModelsObj(propertyKey));
            });
            
            // Check if all loading is complete asynchronously (fires after all promises resolve)
            // Note: This is called after each building category loads, but will only fire callback once all complete
            this.#checkLoadingComplete();
        } else {
            console.warn(`Unknown property property type ${propertyKey}`);
        }
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
            console.warn(`Asset ${assetId} does not exist, see assets: `, this.#assets);
            return undefined;
        }
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