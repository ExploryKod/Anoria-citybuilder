import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {wantedHouses} from "./data.js";

const toolIds = {
    zones: ['grass', 'roads'],
    houses: ['House-Blue', 'House-Red', 'House-Purple', 'House-2Story'],
    tombs:  ['Tombstone-1', 'Tombstone-2', 'Tombstone-3'],
    farms: ['Farm-Wheat', 'Farm-Carrot', 'Farm-Cabbage', 'Windmill-001'],
    markets: ['Market-Stall'],
    nature : []
}

let allAssetsNames = [
    {houses: []},
    {nature: []},
    {farms: []},
    {markets: []},
    {other: []}
];

let assetFullName;

const buildingModelsObj = {};

const tombstonesModelsObj = {};

const assetNames = [];
const tombstonesNames = [];

const farmsNames = [];
const farmsModelsObj = {};

const marketsModelsObj = {};

const playerModelObj = {};
let playerAnimations;

let buttonData = [];

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
        gltf.scenes; // Array<THREE.Group>
        gltf.cameras; // Array<THREE.Camera>
        gltf.asset; // Object

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
                allAssetsNames.map((asset, index) => {
                    if (asset.houses && toolIds.houses.includes(toolName)) {
                        if (wantedHouses.includes(toolName)) {
                            buttonData.push({
                                text: firstNamePart + ' ' + secondNamePart,
                                tool: toolName,
                                group: firstNamePart
                            })
                        }
                        assetNames.push(`${firstNamePart}-${secondNamePart}`);
                        Object.assign(buildingModelsObj, {[`${firstNamePart}-${secondNamePart}`]: child})
                        asset.houses.push({
                            'fullName': child.userData.name,
                            name: `${firstNamePart}-${secondNamePart}`,
                            'mesh': child
                        })
                    } else if (asset.nature && toolIds.nature.includes(toolName)) {
                        asset.nature.push({
                            'fullName': child.userData.name,
                            name: `${firstNamePart}-${secondNamePart}`,
                            'mesh': child
                        })
                    } else if (asset.farms && toolIds.farms.includes(toolName)) {
                        asset.farms.push({
                            'fullName': child.userData.name,
                            name: `${firstNamePart}-${secondNamePart}`,
                            'mesh': child
                        })
                        buttonData.push({
                            text: firstNamePart + ' ' + secondNamePart,
                            tool: toolName,
                            group: firstNamePart
                        })
                        farmsNames.push(`${firstNamePart}-${secondNamePart}`);
                        Object.assign(farmsModelsObj, {[`${firstNamePart}-${secondNamePart}`]: child})

                    } else if(asset.markets && toolIds.markets.includes(toolName)) {
                        asset.markets.push({
                            'fullName': child.userData.name,
                            name: `${firstNamePart}-${secondNamePart}`,
                            'mesh': child
                        })
                        buttonData.push({
                            text: firstNamePart + ' ' + secondNamePart,
                            tool: toolName,
                            group: firstNamePart
                        })
                        Object.assign(marketsModelsObj, {[`${firstNamePart}-${secondNamePart}`]: child})

                    } else if(asset.other) {
                        if(firstNamePart === 'Tombstone') {
                            buttonData.push({text: firstNamePart+ ' ' + secondNamePart, tool: toolName, group: firstNamePart})
                            tombstonesNames.push(`${firstNamePart}-${secondNamePart}`);
                            Object.assign(tombstonesModelsObj, {[`${firstNamePart}-${secondNamePart}`]: child})
                        }

                        asset.other.push({
                            'fullName': child.userData.name,
                            name : `${firstNamePart}-${secondNamePart}`,
                            'mesh': child
                        })
                    }
                })
            }
        });
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

export {
    toolIds,
    buttonData,
    allAssetsNames,
    assetFullName,
    playerModelObj,
    marketsModelsObj,
    assetNames,
    buildingModelsObj,
    tombstonesModelsObj,
    farmsModelsObj,
    playerAnimations
};
