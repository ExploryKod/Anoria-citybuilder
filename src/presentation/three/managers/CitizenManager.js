import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { AnimationMixer } from 'three';
import { assetsConfig } from '../presentationConfig.js';

const MAX_CITIZENS = 3;
const WALK_SPEED = 2; // Units per second

/**
 * Citizen data structure
 */
export class CitizenData {
    constructor() {
        this.character = null; // THREE.Object3D reference
        this.mixer = null; // AnimationMixer
        this.currentAction = null; // Current AnimationAction
        this.spawned = false; // Track if citizen has been spawned
        this.isWalking = false; // Track if citizen is currently walking
        this.targetPosition = null; // Target position for citizen to walk to
        this.path = []; // Path of road tiles to follow
        this.currentPathIndex = 0; // Current index in the path
        this.pathDirection = 1; // 1 for forward, -1 for backward
        this.onRoad = false; // Track if citizen is on a road
        this.waitingForRoad = false; // Track if citizen is waiting for road access
        this.wasWalkingBeforePause = false; // Track if citizen was walking before pause
        this.lastPathRecalculationTurn = -1; // Track last turn when path was recalculated
        this.citizenType = 'citizen02'; // Type of citizen
    }
}

/**
 * Manages all citizen-related functionality
 */
export class CitizenManager {
    constructor(scene, assetManager) {
        this.scene = scene;
        this.assetManager = assetManager;
        this.citizens = [];
        this.previousPopulation = 0;
        this.citizenAnimations = {}; // Shared animation clips for citizen02
        this.citizenCoolAnimations = {}; // Shared animation clips for citizen-cool
        this.citizenAnimationsLoaded = false;
        this.citizenCoolAnimationsLoaded = false;
        this.citizen02Count = 0;
        this.currentCitySize = 16;
        // Parsed GLB scene + embedded animations, loaded from the network
        // ONCE per citizenType and cloned (via SkeletonUtils, so skinned
        // meshes stay bound to their own skeleton) for every instance —
        // see loadCitizenTemplate(). Without this, every single walker
        // spawn re-fetched and re-parsed the GLB from scratch, which is
        // what made a burst of spawns (e.g. a market's round-robin reaching
        // many houses in one distribution cycle) freeze the tab.
        this.citizenTemplates = {};
    }

    /**
     * Initialize citizen manager
     */
    async initialize() {
        this.loadCitizenAnimations();
        this.loadCitizenCoolAnimations();
    }

    /**
     * Reset all citizens
     */
    reset() {
        this.citizens.forEach(citizen => {
            if (citizen.character && citizen.character.parent) {
                citizen.character.parent.remove(citizen.character);
            }
            if (citizen.mixer) {
                Object.values(this.citizenAnimations).forEach(clip => {
                    if (clip) {
                        const action = citizen.mixer.clipAction(clip);
                        if (action && typeof action.isRunning === 'function' && action.isRunning()) {
                            action.stop();
                        }
                    }
                });
            }
        });
        this.citizens = [];
        this.previousPopulation = 0;
    }

    /**
     * Set current city size
     */
    setCitySize(size) {
        this.currentCitySize = size;
    }

    /**
     * Loads animation clips for citizen02
     */
    loadCitizenAnimations() {
        if (this.citizenAnimationsLoaded) {
            return;
        }
        
        const gltfLoader = new GLTFLoader();
        const baseUrl = assetsConfig.baseUrl || '/';
        const citizenPath = `${baseUrl}citizen02/citizenAnimated02.glb`.replace(/\/+/g, '/');
        
        gltfLoader.load(
            citizenPath,
            (gltf) => {
                if (gltf.animations && gltf.animations.length > 0) {
                    gltf.animations.forEach((clip) => {
                        this.citizenAnimations[clip.name] = clip;
                    });
                    this.citizenAnimationsLoaded = true;
                } else {
                    console.warn('[CitizenManager] No animations found in citizen02 GLB file');
                }
            },
            null,
            (error) => {
                console.error('[CitizenManager] Error loading citizen02 animations:', error);
            }
        );
    }

    /**
     * Loads animation clips for citizen-cool
     */
    loadCitizenCoolAnimations() {
        if (this.citizenCoolAnimationsLoaded) {
            return;
        }
        
        const gltfLoader = new GLTFLoader();
        const baseUrl = assetsConfig.baseUrl || '/';
        const citizenPath = `${baseUrl}citizenCool/citizenCoolTwoAnim.glb`.replace(/\/+/g, '/');
        
        gltfLoader.load(
            citizenPath,
            (gltf) => {
                if (gltf.animations && gltf.animations.length > 0) {
                    gltf.animations.forEach((clip) => {
                        this.citizenCoolAnimations[clip.name] = clip;
                    });
                    this.citizenCoolAnimationsLoaded = true;
                } else {
                    console.warn('[CitizenManager] No animations found in citizen-cool GLB file');
                }
            },
            null,
            (error) => {
                console.error('[CitizenManager] Error loading citizen-cool animations:', error);
            }
        );
    }

    /**
     * Gets the appropriate animation set for a citizen based on their type
     */
    getCitizenAnimations(citizen) {
        return citizen && citizen.citizenType === 'citizen-cool' ? this.citizenCoolAnimations : this.citizenAnimations;
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
     * Loads and parses a citizen type's GLB exactly ONCE (network fetch +
     * traverse + material fixup), caching the resulting template scene +
     * embedded animations for every future `createCitizenInstance` call to
     * clone. A failed load is NOT cached — it's removed so the next spawn
     * attempt retries fresh, matching the old always-retry behavior for a
     * transient error, while a successful load stays cached forever.
     */
    loadCitizenTemplate(citizenType) {
        if (this.citizenTemplates[citizenType]) {
            return this.citizenTemplates[citizenType];
        }

        const promise = new Promise((resolve, reject) => {
            const gltfLoader = new GLTFLoader();
            const baseUrl = assetsConfig.baseUrl || '/';
            const citizenPath = citizenType === 'citizen-cool'
                ? `${baseUrl}citizenCool/citizenCoolTwoAnim.glb`.replace(/\/+/g, '/')
                : `${baseUrl}citizen02/citizenAnimated02.glb`.replace(/\/+/g, '/');

            gltfLoader.load(
                citizenPath,
                (gltf) => {
                    const scene = gltf.scene;
                    if (!scene) {
                        const error = new Error(`[CitizenManager] No scene found in GLB file: ${citizenPath}`);
                        console.error(error.message);
                        reject(error);
                        return;
                    }

                    const characterScale = 0.5;
                    scene.scale.set(characterScale, characterScale, characterScale);

                    const lightsToStrip = [];
                    scene.traverse((child) => {
                        // GLBs ship with KHR_lights_punctual DirectionalLight — if left
                        // in the graph it moves with the character and flashes the whole city.
                        if (child.isLight) {
                            lightsToStrip.push(child);
                            return;
                        }
                        if (child.isMesh) {
                            child.castShadow = false;
                            child.receiveShadow = false;

                            if (child.material) {
                                if (child.material instanceof THREE.MeshBasicMaterial) {
                                    const newMaterial = new THREE.MeshLambertMaterial({
                                        map: child.material.map,
                                        color: child.material.color,
                                        transparent: child.material.transparent,
                                        opacity: child.material.opacity
                                    });
                                    child.material = newMaterial;
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

                    resolve({ scene, animations });
                },
                null,
                (error) => {
                    console.error('[CitizenManager] Error loading citizen character:', error);
                    reject(error);
                }
            );
        });

        this.citizenTemplates[citizenType] = promise;
        promise.catch(() => {
            if (this.citizenTemplates[citizenType] === promise) {
                delete this.citizenTemplates[citizenType];
            }
        });
        return promise;
    }

    /**
     * Creates a new citizen instance by cloning the cached template for
     * this citizenType (see loadCitizenTemplate) — never re-loads the GLB
     * itself. Resolves `null` on failure rather than rejecting, same
     * contract as before, so existing callers (`updateCitizens`,
     * WalkerEventController) don't need to change.
     */
    createCitizenInstance(citizenType = 'citizen02') {
        // Keeps the shared clip-name lookup tables (this.citizenAnimations /
        // citizenCoolAnimations) warm for switchCitizenAnimation/
        // getCitizenAnimations, which read them directly rather than
        // through a per-instance template.
        if (citizenType === 'citizen-cool') {
            this.loadCitizenCoolAnimations();
        } else {
            this.loadCitizenAnimations();
        }

        return this.loadCitizenTemplate(citizenType).then(({ scene: templateScene, animations: templateAnimations }) => {
            const citizen = cloneSkinned(templateScene);
            citizen.name = citizenType === 'citizen-cool'
                ? `citizen-cool-${this.citizens.length}`
                : `citizen-${this.citizens.length}`;

            const citizenData = new CitizenData();
            citizenData.character = citizen;
            citizenData.citizenType = citizenType;

            const sharedAnimations = citizenType === 'citizen-cool' ? this.citizenCoolAnimations : this.citizenAnimations;
            const animationsToUseFinal = Object.keys(sharedAnimations).length > 0 ? sharedAnimations : templateAnimations;

            if (Object.keys(animationsToUseFinal).length > 0) {
                citizenData.mixer = new AnimationMixer(citizen);

                const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
                let idleAnimation = null;
                for (const name of idleNames) {
                    if (animationsToUseFinal[name]) {
                        idleAnimation = name;
                        break;
                    }
                }
                if (!idleAnimation && Object.keys(animationsToUseFinal).length > 0) {
                    idleAnimation = Object.keys(animationsToUseFinal)[0];
                }
                if (idleAnimation) {
                    const action = citizenData.mixer.clipAction(animationsToUseFinal[idleAnimation]);
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

    /**
     * Update citizens based on population
     */
    async updateCitizens(currentPopulation, city, findBorderRoads, createRoadPath, recalculateCitizenPath, validatePath) {
        const targetCitizenCount = Math.min(currentPopulation, MAX_CITIZENS);
        const currentCitizenCount = this.citizens.filter(c => c.spawned && c.character && c.character.visible).length;
        
        // Spawn new citizens if population increased
        if (targetCitizenCount > currentCitizenCount) {
            const citizensToSpawn = targetCitizenCount - currentCitizenCount;
            for (let i = 0; i < citizensToSpawn; i++) {
                if (this.citizens.length < MAX_CITIZENS) {
                    let citizenType = 'citizen02';
                    const citizenCoolCount = this.citizens.filter(c => c && c.citizenType === 'citizen-cool').length;
                    
                    if (this.citizen02Count >= 2) {
                        const totalCreatedAfterFirstTwo = (this.citizen02Count - 2) + citizenCoolCount;
                        if (totalCreatedAfterFirstTwo % 2 === 0) {
                            citizenType = 'citizen-cool';
                        } else {
                            citizenType = 'citizen02';
                        }
                    }
                    
                    this.createCitizenInstance(citizenType).then(newCitizen => {
                        if (newCitizen) {
                            this.citizens.push(newCitizen);
                            if (citizenType === 'citizen02') {
                                this.citizen02Count++;
                            }
                            this.spawnCitizenCharacter(newCitizen, city, findBorderRoads, createRoadPath);
                        }
                    });
                }
            }
        }
        
        // Hide citizens if population decreased
        if (targetCitizenCount < currentCitizenCount) {
            const citizensToHide = currentCitizenCount - targetCitizenCount;
            let hiddenCount = 0;
            for (const citizen of this.citizens) {
                if (citizen.spawned && citizen.character && citizen.character.visible && hiddenCount < citizensToHide) {
                    this.hideCitizenCharacter(citizen);
                    hiddenCount++;
                }
            }
        }
        
        // Recalculate citizen paths each turn
        this.citizens.forEach(citizen => {
            if (citizen.character && citizen.spawned) {
                if (citizen.waitingForRoad) {
                    const borderRoads = findBorderRoads(city);
                    if (borderRoads.length > 0) {
                        citizen.waitingForRoad = false;
                        // Force re-entry: waiting citizens are already spawned+parented
                        // at the off-board hold point; spawnCitizenCharacter must run again.
                        citizen.spawned = false;
                        if (citizen.character.parent) {
                            citizen.character.parent.remove(citizen.character);
                        }
                        this.spawnCitizenCharacter(citizen, city, findBorderRoads, createRoadPath);
                    }
                }
                
                if (citizen.onRoad && citizen.path.length > 0) {
                    if (!validatePath(citizen.path)) {
                        recalculateCitizenPath(citizen);
                    } else {
                        recalculateCitizenPath(citizen);
                    }
                }
            }
        });
    }

    /**
     * Spawns a citizen character from outside the scene
     */
    spawnCitizenCharacter(citizen, city, findBorderRoads, createRoadPath) {
        if (!citizen || !citizen.character) {
            return;
        }
        
        if (citizen.spawned && citizen.character.visible && citizen.character.parent) {
            return;
        }
        
        citizen.spawned = false;
        citizen.isWalking = false;
        citizen.targetPosition = null;
        citizen.onRoad = false;
        citizen.waitingForRoad = false;
        citizen.path = [];
        citizen.currentPathIndex = 0;
        citizen.pathDirection = 1;
        citizen.wasWalkingBeforePause = false;
        citizen.lastPathRecalculationTurn = -1;
        
        if (citizen.character.parent) {
            citizen.character.parent.remove(citizen.character);
        }
        
        const borderRoads = findBorderRoads(city);
        
        if (borderRoads.length === 0) {
            citizen.waitingForRoad = true;
            citizen.spawned = true;
            const spawnX = -3;
            const spawnZ = -3;
            citizen.character.position.set(spawnX, 0.21, spawnZ);
            citizen.character.visible = true;
            this.scene.add(citizen.character);
            
            const animationsToUse = this.getCitizenAnimations(citizen);
            const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
            let idleAnimation = null;
            for (const name of idleNames) {
                if (animationsToUse[name]) {
                    idleAnimation = name;
                    break;
                }
            }
            if (idleAnimation) {
                this.switchCitizenAnimation(citizen, idleAnimation, true, 0.2);
            }
            return;
        }
        
        citizen.spawned = true;
        citizen.waitingForRoad = false;
        
        const borderRoadIndex = this.citizens.length % borderRoads.length;
        const targetRoad = borderRoads[borderRoadIndex];
        
        let spawnX, spawnZ;
        if (targetRoad.x === 0) {
            spawnX = -3;
            spawnZ = targetRoad.y;
        } else if (targetRoad.x === city.size - 1) {
            spawnX = city.size + 2;
            spawnZ = targetRoad.y;
        } else if (targetRoad.y === 0) {
            spawnX = targetRoad.x;
            spawnZ = -3;
        } else {
            spawnX = targetRoad.x;
            spawnZ = city.size + 2;
        }
        
        citizen.character.position.set(spawnX, 0.21, spawnZ);
        citizen.character.visible = true;
        this.scene.add(citizen.character);
        
        citizen.targetPosition = new THREE.Vector3(targetRoad.x, 0.21, targetRoad.y);
        citizen.onRoad = false;
        
        const animationsToUse = this.getCitizenAnimations(citizen);
        const walkNames = ['walk', 'Walk', 'Walking', 'walking'];
        let walkAnimation = null;
        for (const name of walkNames) {
            if (animationsToUse[name]) {
                walkAnimation = name;
                break;
            }
        }
        if (!walkAnimation && Object.keys(animationsToUse).length > 1) {
            const animationKeys = Object.keys(animationsToUse);
            walkAnimation = animationKeys[1];
        }
        if (walkAnimation) {
            this.switchCitizenAnimation(citizen, walkAnimation, true, 0.2);
            citizen.isWalking = true;
        }
    }

    /**
     * Hides and removes a citizen character
     */
    hideCitizenCharacter(citizen) {
        if (!citizen || !citizen.character) {
            return;
        }
        
        citizen.character.visible = false;
        
        if (citizen.character.parent) {
            citizen.character.parent.remove(citizen.character);
        }
        
        if (citizen.mixer) {
            Object.values(this.citizenAnimations).forEach(clip => {
                if (clip) {
                    const action = citizen.mixer.clipAction(clip);
                    if (action && typeof action.isRunning === 'function' && action.isRunning()) {
                        action.fadeOut(0.2);
                        action.stop();
                    }
                }
            });
            if (citizen.currentAction && typeof citizen.currentAction.isRunning === 'function' && citizen.currentAction.isRunning()) {
                citizen.currentAction.fadeOut(0.2);
                citizen.currentAction.stop();
            }
        }
        
        citizen.spawned = false;
        citizen.isWalking = false;
        citizen.targetPosition = null;
        citizen.onRoad = false;
        citizen.waitingForRoad = false;
        citizen.path = [];
        citizen.currentPathIndex = 0;
        citizen.pathDirection = 1;
        citizen.wasWalkingBeforePause = false;
        citizen.lastPathRecalculationTurn = -1;
    }

    /**
     * Updates a single citizen's movement and animation
     */
    updateCitizen(citizen, deltaTime, city, isRoadTile, hasBuilding, worldToTile, getAdjacentRoads, createRoadPath, recalculateCitizenPath, validatePath, findBorderRoads) {
        if (!citizen || !citizen.character || !citizen.character.visible) {
            return;
        }
        
        if (citizen.mixer) {
            citizen.mixer.update(deltaTime);
        }
        
        const currentPos = citizen.character.position;
        const currentTile = { x: Math.round(currentPos.x), y: Math.round(currentPos.z) };
        
        if (citizen.waitingForRoad) {
            const borderRoads = findBorderRoads({ size: this.currentCitySize });
            if (borderRoads.length > 0) {
                citizen.waitingForRoad = false;
                const targetRoad = borderRoads[0];
                citizen.targetPosition = new THREE.Vector3(targetRoad.x, 0.21, targetRoad.y);
                citizen.onRoad = false;
                citizen.isWalking = true;
                
                const animationsToUse = this.getCitizenAnimations(citizen);
                const walkNames = ['walk', 'Walk', 'Walking', 'walking'];
                let walkAnimation = null;
                for (const name of walkNames) {
                    if (animationsToUse[name]) {
                        walkAnimation = name;
                        break;
                    }
                }
                if (walkAnimation) {
                    this.switchCitizenAnimation(citizen, walkAnimation, true, 0.2);
                }
            }
            return;
        }
        
        if (citizen.isWalking && citizen.targetPosition && !citizen.onRoad) {
            const direction = new THREE.Vector3()
                .subVectors(citizen.targetPosition, currentPos)
                .normalize();
            
            const distance = currentPos.distanceTo(citizen.targetPosition);
            
            if (distance > 0.1) {
                const moveDistance = WALK_SPEED * deltaTime;
                citizen.character.position.add(
                    direction.multiplyScalar(moveDistance)
                );
                
                if (direction.length() > 0) {
                    const angle = Math.atan2(direction.x, direction.z);
                    citizen.character.rotation.y = angle;
                }
            } else {
                citizen.character.position.copy(citizen.targetPosition);
                citizen.onRoad = true;
                
                citizen.path = createRoadPath(currentTile.x, currentTile.y);
                citizen.currentPathIndex = 0;
                citizen.pathDirection = 1;
                
                if (citizen.path.length > 1) {
                    const nextTile = citizen.path[1];
                    citizen.targetPosition = new THREE.Vector3(nextTile.x, 0.21, nextTile.y);
                } else {
                    citizen.isWalking = false;
                    citizen.targetPosition = null;
                    const animationsToUse = this.getCitizenAnimations(citizen);
                    const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
                    let idleAnimation = null;
                    for (const name of idleNames) {
                        if (animationsToUse[name]) {
                            idleAnimation = name;
                            break;
                        }
                    }
                    if (idleAnimation) {
                        this.switchCitizenAnimation(citizen, idleAnimation, true, 0.3);
                    }
                }
            }
            return;
        }
        
        if (citizen.isWalking && citizen.onRoad && citizen.path.length > 0 && citizen.targetPosition) {
            if (!validatePath(citizen.path)) {
                if (!recalculateCitizenPath(citizen)) {
                    return;
                }
            }
            
            const direction = new THREE.Vector3()
                .subVectors(citizen.targetPosition, currentPos)
                .normalize();
            
            const distance = currentPos.distanceTo(citizen.targetPosition);
            
            if (distance > 0.1) {
                const moveDistance = WALK_SPEED * deltaTime;
                citizen.character.position.add(
                    direction.multiplyScalar(moveDistance)
                );
                
                if (direction.length() > 0) {
                    const angle = Math.atan2(direction.x, direction.z);
                    citizen.character.rotation.y = angle;
                }
                
                const tile = worldToTile(citizen.character.position);
                if (!isRoadTile(tile.x, tile.y) || hasBuilding(tile.x, tile.y)) {
                    if (!recalculateCitizenPath(citizen)) {
                        return;
                    }
                }
            } else {
                citizen.character.position.copy(citizen.targetPosition);
                citizen.currentPathIndex += citizen.pathDirection;
                
                if (citizen.currentPathIndex >= citizen.path.length) {
                    citizen.pathDirection = -1;
                    citizen.currentPathIndex = citizen.path.length - 2;
                } else if (citizen.currentPathIndex < 0) {
                    citizen.pathDirection = 1;
                    citizen.currentPathIndex = 1;
                }
                
                if (!validatePath(citizen.path)) {
                    if (!recalculateCitizenPath(citizen)) {
                        return;
                    }
                }
                
                if (citizen.path.length > 1 && citizen.currentPathIndex >= 0 && citizen.currentPathIndex < citizen.path.length) {
                    const nextTile = citizen.path[citizen.currentPathIndex];
                    citizen.targetPosition = new THREE.Vector3(nextTile.x, 0.21, nextTile.y);
                } else {
                    if (!recalculateCitizenPath(citizen)) {
                        return;
                    }
                }
            }
        }
    }

    /**
     * Update all citizens (called every frame)
     */
    updateAllCitizens(deltaTime, city, isRoadTile, hasBuilding, worldToTile, getAdjacentRoads, createRoadPath, recalculateCitizenPath, validatePath, findBorderRoads) {
        this.citizens.forEach(citizen => {
            this.updateCitizen(citizen, deltaTime, city, isRoadTile, hasBuilding, worldToTile, getAdjacentRoads, createRoadPath, recalculateCitizenPath, validatePath, findBorderRoads);
        });
    }

    /**
     * Pauses all citizen animations
     */
    pauseCitizens() {
        this.citizens.forEach(citizen => {
            if (!citizen.character || !citizen.character.visible) {
                return;
            }
            
            citizen.wasWalkingBeforePause = citizen.isWalking;
            citizen.isWalking = false;
            
            const animationsToUse = this.getCitizenAnimations(citizen);
            const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
            let idleAnimation = null;
            for (const name of idleNames) {
                if (animationsToUse[name]) {
                    idleAnimation = name;
                    break;
                }
            }
            
            if (!idleAnimation && Object.keys(animationsToUse).length > 0) {
                idleAnimation = Object.keys(animationsToUse)[0];
            }
            
            if (idleAnimation) {
                this.switchCitizenAnimation(citizen, idleAnimation, true, 0.3);
            }
        });
    }

    /**
     * Resumes all citizen animations
     */
    resumeCitizens() {
        this.citizens.forEach(citizen => {
            if (!citizen.character || !citizen.character.visible) {
                return;
            }
            
            const shouldBeWalking = 
                (citizen.wasWalkingBeforePause || citizen.onRoad || citizen.targetPosition || citizen.path.length > 0) &&
                !citizen.waitingForRoad;
            
            if (shouldBeWalking) {
                citizen.isWalking = true;
                
                const animationsToUse = this.getCitizenAnimations(citizen);
                const walkNames = ['walk', 'Walk', 'Walking', 'walking'];
                let walkAnimation = null;
                for (const name of walkNames) {
                    if (animationsToUse[name]) {
                        walkAnimation = name;
                        break;
                    }
                }
                
                if (!walkAnimation && Object.keys(animationsToUse).length > 1) {
                    const animationKeys = Object.keys(animationsToUse);
                    walkAnimation = animationKeys[1];
                }
                
                if (walkAnimation) {
                    this.switchCitizenAnimation(citizen, walkAnimation, true, 0.3);
                }
            } else {
                const animationsToUse = this.getCitizenAnimations(citizen);
                const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
                let idleAnimation = null;
                for (const name of idleNames) {
                    if (animationsToUse[name]) {
                        idleAnimation = name;
                        break;
                    }
                }
                
                if (!idleAnimation && Object.keys(animationsToUse).length > 0) {
                    idleAnimation = Object.keys(animationsToUse)[0];
                }
                
                if (idleAnimation) {
                    this.switchCitizenAnimation(citizen, idleAnimation, true, 0.3);
                }
            }
        });
    }
}
