import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { meshNameMapping } from './data.js';

class MeshLoader {

    toolIds = {
            zones: ['grass', 'roads'],
            houses: ['House-Blue', 'House-Red', 'House-Purple', 'House-2Story'],
            tombs:  ['Tombstone-1', 'Tombstone-2', 'Tombstone-3'],
            farms: ['Farm-Wheat', 'Farm-Carrot', 'Farm-Cabbage', 'Windmill-001'],
            markets: ['Market-Stall'],
            nature : []
        }

        allAssetsNames = [
            {houses: []},
            {nature: []},
            {farms: []},
            {markets: []},
            {other: []}
        ];

     assetFullName = ""
     buttonData = [];

     modelsObj = {
         'houses': {},
         'tombs': {},
         'farms': {},
         'markets': {},
         'nature': {}
     }
     modelMetas = {
         'houses': { size: 0.5},
         'tombs': { size: 0.5},
         'farms': { size: 1},
         'markets': { size: 0.7},
         'nature': { size: 0.5}
     }
     assetNames = []

    // Performance optimization: Cache for parsed tool names
    cache = new Map();

    constructor() {

    }

    async loadAssets(assetFullName, propertyKey, modelsObj, allAssetsNames, assetNames, toolIds, buttonData) {
        return new Promise((resolve, reject) => {
            // Performance optimization: Use Set for O(1) lookup instead of array includes
            const validToolIds = new Set(toolIds[propertyKey] || []);
            const processedMeshes = new Set(); // Track processed meshes to avoid duplicates
            
            // Instantiate a loader
            const gltfloader = new GLTFLoader();

            // Optional: Provide a DRACOLoader instance to decode compressed mesh data
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath( '/examples/jsm/libs/draco/' );
            gltfloader.setDRACOLoader( dracoLoader );

            // Load a glTF resource if file with several assets
            gltfloader.load(
                // resource URL
                `./resources/lowpoly/village_town_assets_v2.glb`,
                // called when the resource is loaded
                function ( gltf ) {

                    gltf.animations; // Array<THREE.AnimationClip>
                    gltf.scene; // THREE.Group

                    gltf.scene.traverse(function (child) {
                        // Processing child mesh
                        if (child instanceof THREE.Mesh) {
                        // Market Stall Red.002_Material.005_0
                        assetFullName = child.name
                        assetFullName = assetFullName.replace(/[._\s]/g, '_');
                        const firstNamePart = assetFullName.split('_')[0]
                        const secondNamePart = assetFullName.split('_')[1]
                        
                        // Check if this is a Windmill mesh (special handling)
                        const isWindmill = firstNamePart.toLowerCase().includes('windmill') || 
                                           child.name.toLowerCase().includes('windmill');
                        
                        let toolName;
                        if (isWindmill) {
                            // Special handling for Windmill: extract the actual name like "Windmill" or "Windmill001"
                            // child.name format: "Windmill_Material005_0" or "Windmill001_Material005_0"
                            // Extract base name: remove "_MaterialXXX_X" suffix
                            let baseName = child.name.split('_Material')[0];
                            
                            // Now baseName is either "Windmill" or "Windmill001" (no dots!)
                            // Convert to standardized format
                            toolName = baseName.replace(/\./g, '-'); // Handle any dots if present
                            
                            // Apply mapping to normalize all variants to "Windmill-001"
                            if (meshNameMapping[toolName]) {
                                const mappedName = meshNameMapping[toolName];
                                console.log(`[LOADER] Mapping Windmill variant: ${toolName} → ${mappedName}`);
                                toolName = mappedName;
                            }
                        } else {
                            // Original logic for all other objects
                            toolName = `${firstNamePart}-${secondNamePart}`
                            
                            // Check if we need to map the name
                            if (meshNameMapping[toolName]) {
                                const mappedName = meshNameMapping[toolName];
                                console.log(`[LOADER] Mapping ${toolName} → ${mappedName}`);
                                toolName = mappedName;
                            }
                        }
                        
                        // Performance optimization: Early exit - skip if mesh already processed
                        if (processedMeshes.has(child.name)) {
                            return;
                        }
                        
                        // Performance optimization: Early exit - skip if not a valid tool
                        if (!validToolIds.has(toolName)) {
                            return;
                        }
                        
                        // Mark as processed
                        processedMeshes.add(child.name);
                        
                        // Debug: log farm assets and windmill
                        if (propertyKey === 'farms' || toolName.toLowerCase().includes('windmill')) {
                            console.log(`[LOADER] Farm mesh: ${child.name}`);
                            console.log(`[LOADER]   firstNamePart: ${firstNamePart}`);
                            console.log(`[LOADER]   secondNamePart: ${secondNamePart}`);
                            console.log(`[LOADER]   isWindmill: ${isWindmill}`);
                            console.log(`[LOADER]   toolName: ${toolName}`);
                            console.log(`[LOADER]   storing in modelsObj[${propertyKey}][${toolName}]`);
                        }
                        
                        // Performance optimization: Direct access instead of nested map
                        const housesArray = allAssetsNames.find(asset => Object.hasOwn(asset, propertyKey))?.[propertyKey];
                        if (housesArray) {
                            if (propertyKey === 'farms') {
                                console.log(`[LOADER] Adding farm to buttonData: ${toolName}`);
                                console.log(`[LOADER] modelsObj[${propertyKey}] before:`, Object.keys(modelsObj[propertyKey]));
                            }
                            
                            buttonData.push({
                                text: firstNamePart + ' ' + secondNamePart,
                                tool: toolName,
                                group: firstNamePart
                            });
                            
                            assetNames.push(toolName);
                            
                            // Store the mesh with the toolName as key
                            modelsObj[propertyKey][toolName] = child;
                            
                            if (propertyKey === 'farms') {
                                console.log(`[LOADER] modelsObj[${propertyKey}] after:`, Object.keys(modelsObj[propertyKey]));
                            }
                            
                            housesArray.push({
                                'fullName': child.userData.name,
                                name: toolName,
                                'mesh': child
                            });
                        }
                    }
                    });
                    resolve(modelsObj);
                },
                // called while loading is progressing
                function ( xhr ) {
                    // Loading progress
                },
                // called when loading has errors
                function ( error ) {
                    console.error( 'An error happened' , error);
                    reject(error);
                }
            );
        });
    }
}

export default MeshLoader;