import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { AnimationMixer } from 'three';
import { assetsConfig } from '../presentationConfig.js';
import { WALKER_TYPES } from '../assets/walkerAssets.js';
import { getWalkerAsset, resolveWalkerAppearanceId, resolveWalkerClipName } from '../walkers/walkerAppearance.js';

/** World platform height (see terrainWorldContract.js WORLD_PLATFORM_Y). */
const PLATFORM_HEIGHT = 0.2;

/**
 * One spawned walker's data.
 */
export class CitizenData {
    constructor() {
        this.character = null; // THREE.Object3D reference
        this.mixer = null; // AnimationMixer
        this.currentAction = null; // Current AnimationAction
        this.citizenType = null; // walker type (key of WALKER_TYPES)
        this.appearanceId = null; // visual (key of WALKER_ASSETS)
        this.animations = {}; // clip name → AnimationClip, from this visual's own GLB
        this.groundY = PLATFORM_HEIGHT; // height of the character's feet in the scene
    }
}

/**
 * Creates the walkers' characters. What a character looks like — model, size,
 * feet height, facing, animation clip names, and which visuals a walker type
 * may use — is declared in assets/walkerAssets.js; nothing here names a model.
 */
export class CitizenManager {
    constructor(scene, assetManager) {
        this.scene = scene;
        this.assetManager = assetManager;
        this.currentCitySize = 16;
        // Parsed GLB scene + embedded animations, loaded from the network
        // ONCE per visual and cloned (via SkeletonUtils, so skinned meshes stay
        // bound to their own skeleton) for every instance — see
        // loadCitizenTemplate(). Without this, every single walker spawn
        // re-fetched and re-parsed the GLB from scratch, which is what made a
        // burst of spawns (e.g. a market's round-robin reaching many houses in
        // one distribution cycle) freeze the tab.
        this.citizenTemplates = {};
        /** @type {Record<string, number>} walkers spawned so far, per walker type (drives 'sequence' picks) */
        this.spawnCounts = {};
    }

    /**
     * Warm the cache with every visual the walker types can use, so the first
     * spawn does not wait for the network. Failures are retried at spawn time.
     */
    async initialize() {
        const appearanceIds = new Set(Object.values(WALKER_TYPES).flatMap((type) => type.appearances));
        await Promise.allSettled([...appearanceIds].map((id) => this.loadCitizenTemplate(id)));
    }

    /**
     * New game: the round-robin restarts.
     */
    reset() {
        this.spawnCounts = {};
    }

    /**
     * Set current city size
     */
    setCitySize(size) {
        this.currentCitySize = size;
    }

    /**
     * Gets the animation clips of a citizen's own model.
     */
    getCitizenAnimations(citizen) {
        return citizen?.animations ?? {};
    }

    /**
     * The clip name playing a role ('idle', 'walk') for this citizen, resolved
     * from the names its asset declares (null if the model has none).
     */
    pickAnimationName(citizen, role) {
        if (!citizen?.appearanceId) return null;
        return resolveWalkerClipName(citizen.appearanceId, role, Object.keys(this.getCitizenAnimations(citizen)));
    }

    /**
     * Switches a citizen's animation
     */
    switchCitizenAnimation(citizen, animationName, fadeIn = true, fadeDuration = 0.3) {
        if (!citizen || !citizen.mixer) {
            return;
        }

        const animationsToUse = this.getCitizenAnimations(citizen);

        if (!animationsToUse[animationName]) {
            console.warn('[CitizenManager] Cannot switch animation:', animationName, 'Available:', Object.keys(animationsToUse), 'Type:', citizen.citizenType);
            return;
        }

        // Stop current animation
        if (citizen.currentAction) {
            if (fadeIn) {
                citizen.currentAction.fadeOut(fadeDuration);
            } else {
                citizen.currentAction.stop();
            }
        }

        // Play new animation
        const newAction = citizen.mixer.clipAction(animationsToUse[animationName]);
        if (fadeIn) {
            newAction.reset().fadeIn(fadeDuration).play();
        } else {
            newAction.reset().play();
        }

        citizen.currentAction = newAction;
    }

    /**
     * Loads and parses one visual's GLB exactly ONCE (network fetch +
     * traverse + material fixup), caching the resulting template scene +
     * embedded animations for every future `createCitizenInstance` call to
     * clone. A failed load is NOT cached — it's removed so the next spawn
     * attempt retries fresh, while a successful load stays cached forever.
     *
     * @param {string} appearanceId key of WALKER_ASSETS
     */
    loadCitizenTemplate(appearanceId) {
        if (this.citizenTemplates[appearanceId]) {
            return this.citizenTemplates[appearanceId];
        }

        const asset = getWalkerAsset(appearanceId);
        const promise = new Promise((resolve, reject) => {
            const gltfLoader = new GLTFLoader();
            const baseUrl = assetsConfig.baseUrl || '/';
            const citizenPath = encodeURI(`${baseUrl}${asset.geometry.glb}`.replace(/\/+/g, '/'));

            gltfLoader.load(
                citizenPath,
                (gltf) => {
                    const model = gltf.scene;
                    if (!model) {
                        const error = new Error(`[CitizenManager] No scene found in GLB file: ${citizenPath}`);
                        console.error(error.message);
                        reject(error);
                        return;
                    }

                    // The walker code sets the ROOT's yaw to face its walking direction, so the
                    // model's own facing correction lives on an inner node and the size on the root.
                    model.rotation.y = THREE.MathUtils.degToRad(asset.transform?.rotationDeg?.y ?? 0);
                    const root = new THREE.Group();
                    root.add(model);
                    root.scale.setScalar(asset.transform?.scale ?? 1);

                    const lightsToStrip = [];
                    root.traverse((child) => {
                        // GLBs may ship a KHR_lights_punctual light — if left in the graph it
                        // moves with the character and flashes the whole city.
                        if (child.isLight) {
                            lightsToStrip.push(child);
                            return;
                        }
                        if (child.isMesh) {
                            child.castShadow = false;
                            child.receiveShadow = false;

                            if (child.material) {
                                if (child.material instanceof THREE.MeshBasicMaterial) {
                                    child.material = new THREE.MeshLambertMaterial({
                                        map: child.material.map,
                                        color: child.material.color,
                                        transparent: child.material.transparent,
                                        opacity: child.material.opacity
                                    });
                                }

                                if (child.material.needsUpdate !== undefined) {
                                    child.material.needsUpdate = true;
                                }
                            }
                        }
                    });
                    for (const light of lightsToStrip) {
                        light.parent?.remove(light);
                        light.dispose?.();
                    }

                    const animations = {};
                    (gltf.animations ?? []).forEach((clip) => {
                        animations[clip.name] = clip;
                    });

                    resolve({ scene: root, animations });
                },
                null,
                (error) => {
                    console.error('[CitizenManager] Error loading citizen character:', error);
                    reject(error);
                }
            );
        });

        this.citizenTemplates[appearanceId] = promise;
        promise.catch(() => {
            if (this.citizenTemplates[appearanceId] === promise) {
                delete this.citizenTemplates[appearanceId];
            }
        });
        return promise;
    }

    /**
     * Creates a walker of a logical type (key of WALKER_TYPES): the type's
     * declarative pool decides which visual it gets, then the cached template
     * of that visual is cloned — the GLB is never re-loaded. Resolves `null`
     * on failure rather than rejecting, so callers (WalkerEventController)
     * just skip the walker.
     *
     * @param {string} [walkerType]
     */
    createCitizenInstance(walkerType = 'citizen') {
        let appearanceId;
        try {
            const spawned = this.spawnCounts[walkerType] ?? 0;
            appearanceId = resolveWalkerAppearanceId(walkerType, spawned);
            this.spawnCounts[walkerType] = spawned + 1;
        } catch (error) {
            console.error('[CitizenManager] Error creating citizen instance:', error);
            return Promise.resolve(null);
        }

        const asset = getWalkerAsset(appearanceId);
        return this.loadCitizenTemplate(appearanceId).then(({ scene: templateScene, animations }) => {
            const character = cloneSkinned(templateScene);
            character.name = `citizen-${appearanceId}`;

            const citizenData = new CitizenData();
            citizenData.character = character;
            citizenData.citizenType = walkerType;
            citizenData.appearanceId = appearanceId;
            citizenData.animations = animations;
            citizenData.groundY = PLATFORM_HEIGHT + (asset.transform?.positionOffsetY ?? 0);

            if (Object.keys(animations).length > 0) {
                citizenData.mixer = new AnimationMixer(character);
                const idleAnimation = this.pickAnimationName(citizenData, 'idle');
                if (idleAnimation) {
                    const action = citizenData.mixer.clipAction(animations[idleAnimation]);
                    action.play();
                    citizenData.currentAction = action;
                }
            }

            return citizenData;
        }).catch((error) => {
            console.error('[CitizenManager] Error creating citizen instance:', error);
            return null;
        });
    }
}
