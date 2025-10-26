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

    constructor() {

    }

    async loadAssets(assetFullName, propertyKey, modelsObj, allAssetsNames, assetNames, toolIds, buttonData) {
        return new Promise((resolve, reject) => {
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
                            // Special handling for Windmill: extract the actual name like "Windmill.001"
                            const baseName = child.name.split('_Material')[0].split('_')[0];
                            toolName = baseName.replace(/\./g, '-'); // "Windmill.001" -> "Windmill-001"
                            
                            // Check mapping for Windmill variants
                            if (meshNameMapping[toolName]) {
                                const mappedName = meshNameMapping[toolName];
                                console.log(`[LOADER] Mapping Windmill ${toolName} → ${mappedName}`);
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
                        
                        // Debug: log farm assets and windmill
                        if (propertyKey === 'farms' || toolName.toLowerCase().includes('windmill')) {
                            console.log(`[LOADER] Farm mesh: ${child.name}`);
                            console.log(`[LOADER]   firstNamePart: ${firstNamePart}`);
                            console.log(`[LOADER]   secondNamePart: ${secondNamePart}`);
                            console.log(`[LOADER]   isWindmill: ${isWindmill}`);
                            console.log(`[LOADER]   toolName: ${toolName}`);
                            console.log(`[LOADER]   storing in modelsObj[${propertyKey}][${toolName}]`);
                        }
                        //console.warn("[BUILDING] tool name", toolName)
                            allAssetsNames.map((asset) => {
                                if (Object.hasOwn(asset, propertyKey) &&
                                    Array.isArray(asset[propertyKey]) &&
                                    Array.isArray(toolIds[propertyKey])) {

                                    const housesArray = asset[propertyKey];
                                    if (housesArray && toolIds[propertyKey].includes(toolName)) {
                                        if (propertyKey === 'farms') {
                                            console.log(`[LOADER] Adding farm to buttonData: ${toolName}`);
                                            console.log(`[LOADER] modelsObj[${propertyKey}] before:`, Object.keys(modelsObj[propertyKey]));
                                        }
                                        buttonData.push({
                                            text: firstNamePart + ' ' + secondNamePart,
                                            tool: toolName,
                                            group: firstNamePart
                                        })
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
                                        })
                                    }
                                }

                            })
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