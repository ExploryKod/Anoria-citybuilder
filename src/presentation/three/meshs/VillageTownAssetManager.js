import * as THREE from 'three';
import { applyPlacementRotationStep } from '../placement/placementRotation.js';
import { textures } from './data.js';
import { VILLAGE_MESH_TOOL_IDS_BY_CATEGORY } from '../../../shared/building-catalog/villageAssetSets.js';
import { attachSceneTilePort } from '../scene-board/SceneTilePort.js';
import { createSceneTile } from '../scene-board/SceneObjectRegistry.js';
import { registerTerrainSceneFactories } from '../scene-board/terrain/registerTerrainSceneFactories.js';
import { registerNatureSceneFactories } from '../scene-board/nature/registerNatureSceneFactories.js';
import {
  EDITOR_NATURE_TOOL_IDS,
  EDITOR_TERRAIN_TOOL_IDS,
} from '../../../shared/editor-catalog/editorKenneyCatalog.js';

/**
 * Scene asset manager for the sources that are NOT a per-id GLB adapter:
 * the procedural ground tiles (grass / terrain), the editor terrain / nature
 * scene tiles, and the shared status sprites. Every placeable building, road
 * and nature piece is created through its own BuildingSourceAdapter (see
 * resolveBuildingMesh.js) — nothing here loads a GLB any more.
 */
class VillageTownAssetManager {
    #geometry = new THREE.BoxGeometry(1, 1, 1);
    #assets = {};

    // Shared materials for terrain - created once and reused to avoid texture unit limit
    #sharedTerrainMaterials = null;

    // Shared sprite materials - created once per texture type to avoid texture unit limit
    #sharedSpriteMaterials = new Map();

    getSharedTerrainMaterials() {
        return this.#getSharedTerrainMaterials();
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

    // Initialize shared terrain materials (called once, reused for all tiles)
    #getSharedTerrainMaterials() {
        if (!this.#sharedTerrainMaterials) {
            // Vérifier que les textures sont chargées
            if (!textures['grass']) {
                console.error('[VillageTownAssetManager] Textures not loaded yet!', {
                    grass: !!textures['grass']
                });
            }

            // Create shared materials once - these will be reused for all terrain tiles
            // This prevents exceeding WebGL texture unit limit (32 max)
            // NOTE: Removed specularMap to save texture units (not critical for visual quality)
            this.#sharedTerrainMaterials = {
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
            if (this.#sharedTerrainMaterials['grass'].map) {
                this.#sharedTerrainMaterials['grass'].map.needsUpdate = true;
            }
        }
        return this.#sharedTerrainMaterials;
    }

    #createTerrain(x, y, buildingId = '') {
        const port = createSceneTile(buildingId, x, y);
        attachSceneTilePort(port);
        return port.root;
    }

    async initializeTerrains() {
        registerTerrainSceneFactories({
            getSharedTerrainMaterials: () => this.#getSharedTerrainMaterials(),
            getTerrainBoxGeometry: () => this.#geometry,
        });
        registerNatureSceneFactories();

        VILLAGE_MESH_TOOL_IDS_BY_CATEGORY.zones.forEach(toolId => {
            this.#assets[toolId] = (x, y) => this.#createTerrain(x, y, toolId);
        });

        for (const toolId of EDITOR_TERRAIN_TOOL_IDS) {
            this.#assets[toolId] = (x, y) => {
                const port = createSceneTile(toolId, x, y, { presentation: 'lit' });
                attachSceneTilePort(port);
                return port.root;
            };
        }

        for (const toolId of EDITOR_NATURE_TOOL_IDS) {
            this.#assets[toolId] = (x, y) => {
                const port = createSceneTile(toolId, x, y);
                attachSceneTilePort(port);
                return port.root;
            };
        }
    }

    createAsset(assetId, x, y, options = null) {
        if (!(assetId in this.#assets)) {
            console.warn(`[VillageTownAssetManager] Asset ${assetId} does not exist`);
            return undefined;
        }
        const mesh = this.#assets[assetId](x, y);

        const rotationStep = options?.rotationStep ?? options?.placementRotationStep ?? 0;
        if (mesh && rotationStep) {
            applyPlacementRotationStep(mesh, rotationStep);
        }
        return mesh;
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

export default VillageTownAssetManager;
