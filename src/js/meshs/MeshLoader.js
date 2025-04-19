import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

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
                    // console.log(child);
                    if (child instanceof THREE.Mesh) {
                        // Market Stall Red.002_Material.005_0
                        assetFullName = child.name
                        assetFullName = assetFullName.replace(/[._\s]/g, '_');
                        const firstNamePart = assetFullName.split('_')[0]
                        const secondNamePart = assetFullName.split('_')[1]
                        const toolName = `${firstNamePart}-${secondNamePart}`
                        //console.warn("[BUILDING] tool name", toolName)
                        allAssetsNames.map((asset) => {
                            if (Object.hasOwn(asset, propertyKey) &&
                                Array.isArray(asset[propertyKey]) &&
                                Array.isArray(toolIds[propertyKey])) {

                                const housesArray = asset[propertyKey];
                                if (housesArray && toolIds[propertyKey].includes(toolName)) {
                                    buttonData.push({
                                        text: firstNamePart + ' ' + secondNamePart,
                                        tool: toolName,
                                        group: firstNamePart
                                    })
                                    assetNames.push(`${firstNamePart}-${secondNamePart}`);
                                    Object.assign(modelsObj[propertyKey], {[`${firstNamePart}-${secondNamePart}`]: child})
                                    housesArray.push({
                                        'fullName': child.userData.name,
                                        name: `${firstNamePart}-${secondNamePart}`,
                                        'mesh': child
                                    })
                                }
                            }

                        })
                    }
                });
                return modelsObj;
            },
            // called while loading is progressing
            function ( xhr ) {

                // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

            },
            // called when loading has errors
            function ( error ) {

                console.error( 'An error happened' , error);

            }
        );
    }
}

export default MeshLoader;