import * as THREE from 'three';
import { textures } from '../../presentation/three/meshs/data.js';

let hoveredObject = null;
let neighborsHoveredObjects = [];
let materialProps = {
    emissive: 0x00ff00,
    opacity: 0.5,
    transparent: true,
    wireframe: false
}

const types = [
    THREE.MeshLambertMaterial,
    THREE.MeshStandardMaterial
]

/**
 * Changes the emissive color of a building when it is hovered over.
 * If the building is already hovered, its color will be reset to the default color.
 * The function also ensures that the original emissive color is stored and restored when needed.
 *
 * @param {Array} intersections - The array of intersections from raycasting, containing the objects intersected by the ray at intersection[0].object.
 * @param data
 */
export function coloredAbuildingOnHover(intersections, data={color: 0xff0000, defaultColor : 0x000000, areaKey:'area_1'}) {

   const areaKey = data.areaKey
   if (intersections.length > 0) {
       const intersectedObject = intersections[0].object;

       if (intersectedObject !== hoveredObject) {
           
           // Reset the emissive color of the previously hovered object
           if (hoveredObject && hoveredObject.material && hoveredObject.material.emissive) {
                if (isMaterialTypeFound(hoveredObject.material, types) ) {
                   // Reset to the original emissive color stored in userData
                   hoveredObject.material = hoveredObject.userData.originalMaterial || hoveredObject.material;
                   hoveredObject.material.emissive.setHex(hoveredObject.userData.originalEmissive || data.defaultColor);

                   if(Object.hasOwn(hoveredObject.userData, 'neighborsMeshs')) {
                        neighborsHoveredObjects = hoveredObject.userData.neighborsMeshs
                        // Processing neighbors mesh
                        neighborsHoveredObjects.forEach((neighborsHoveredObject) => {
                            // Processing neighbor object
                            setColorOnMaterialArray(neighborsHoveredObject, 0x000000)
                        })
                  } 

                //   if (Object.hasOwn(hoveredObject.userData, 'neighborZones')) {
                //     if(Object.hasOwn(hoveredObject.userData.neighborZones, data.areaKey)) {
                //         const area2 = hoveredObject.userData.neighborZones[data.areaKey]
                //         if(Object.hasOwn(area2, 'allTerrainMeshInZone')) {
                //             area2.allTerrainMeshInZone.forEach((terrain) => {
                //                 console.log(" [coloredABuildingOnHover] a zone neighbor object", terrain)
                //                 setColorOnMaterialArray(terrain, 0x000000)
                //             })
                //         }
                        
                //     }
                //   }
               }

               if (hoveredObject && Array.isArray(hoveredObject.material)) {
                console.warn(" [coloredABuildingOnHover] HOVER OBJECT BECOME ARRAY MATERIAL")
                // Iterate over the array of MeshLambertMaterial objects
                    hoveredObject.material.filter((material) => isMaterialTypeFound(material, types)).forEach((material) => {
                        if (material.emissive) {
                            // Material emissive processing
                    
                            // Reset to the original emissive color stored in userData
                            material.emissive.setHex(0x3333CC)
                            if(Object.hasOwn(hoveredObject.userData, 'neighborsMeshs')) {
                                neighborsHoveredObjects = hoveredObject.userData.neighborsMeshs
                                // Processing neighbors mesh
                                neighborsHoveredObjects.forEach((neighborsHoveredObject) => {
                                    // Processing neighbor object
                                    setColorOnMaterialArray(neighborsHoveredObject, 0x000000)
                                })
                            } 

                            // if (Object.hasOwn(hoveredObject.userData, 'neighborZones')) {
                            //     if(Object.hasOwn(hoveredObject.userData.neighborZones, areaKey)) {
                            //         const area2 = hoveredObject.userData.neighborZones[areaKey]
                            //         if(Object.hasOwn(area2, 'allTerrainMeshInZone')) {
                            //             area2.allTerrainMeshInZone.forEach((terrain) => {
                            //                 console.log(" [coloredABuildingOnHover] a zone neighbor object", terrain)
                            //                 setColorOnMaterialArray(terrain, 0x000000)
                            //             })
                            //         }
                                    
                            //     }
                            // }
                        }
                    });
                }
           }

           // Set the new hovered object
           hoveredObject = intersectedObject;
        
           if(hoveredObject.userData.isBuilding) {
            
                // Store the original emissive color and material if not already stored
                if (!hoveredObject.userData.originalEmissive && hoveredObject.material && hoveredObject.material.emissive) {
                    hoveredObject.userData.originalEmissive = hoveredObject.material.emissive.getHex();
                    hoveredObject.userData.originalMaterial = hoveredObject.material.clone(); // Store the original material
                }

                // Change the emissive color to the specified color
                if (hoveredObject.material && hoveredObject.material.emissive) {
                    hoveredObject.material = hoveredObject.material.clone(); // Clone the material for manipulation
                    hoveredObject.material.emissive.setHex(data.color);

                    if(Object.hasOwn(hoveredObject.userData, 'neighborsMeshs')) {
                        neighborsHoveredObjects = hoveredObject.userData.neighborsMeshs
                        // Processing neighbors mesh
                        neighborsHoveredObjects.forEach((neighborsHoveredObject) => {
                            // Processing neighbor object
                            setColorOnMaterialArray(neighborsHoveredObject, 0x3333CC)
                        })
                    } 
                    // Processing neighbor zones
                    // if (Object.hasOwn(hoveredObject.userData, 'neighborZones')) {
                    //     if(Object.hasOwn(hoveredObject.userData.neighborZones, areaKey)) {
                    //         const area2 = hoveredObject.userData.neighborZones[areaKey]
                    //         console.log(" [coloredABuildingOnHover] a zone neighbor area2", area2)
                    //         if(Object.hasOwn(area2, 'allTerrainMeshInZone')) {
                    //             area2.allTerrainMeshInZone.forEach((terrain) => {
                    //                 console.log(" [coloredABuildingOnHover] emissive a zone neighbor object", terrain)
                    //                 setColorOnMaterialArray(terrain, 0x3333CC)
                    //             })
                    //         }
                            
                    //     }
                    // }
                }
               
                
        
           } else {
              console.warn("Hover object is not a building")
              hoveredObject = null; 
              return;
           }
       }
   } else {
       // Reset the emissive color if no object is hovered
       if (hoveredObject && hoveredObject.material && hoveredObject.material.emissive) {
           hoveredObject.material = hoveredObject.userData.originalMaterial || hoveredObject.material;
           hoveredObject.material.emissive.setHex(hoveredObject.userData.originalEmissive || data.defaultColor);

           if(Object.hasOwn(hoveredObject.userData, 'neighborsMeshs')) {
            neighborsHoveredObjects = hoveredObject.userData.neighborsMeshs
                neighborsHoveredObjects.forEach((neighborsHoveredObject) => {
                    setColorOnMaterialArray(neighborsHoveredObject, 0x000000)
                })
            } 

            // if (Object.hasOwn(hoveredObject.userData, 'neighborZones')) {
            //     if(Object.hasOwn(hoveredObject.userData.neighborZones, areaKey)) {
            //         const area2 = hoveredObject.userData.neighborZones[areaKey]
            //         if(Object.hasOwn(area2, 'allTerrainMeshInZone')) {
            //             area2.allTerrainMeshInZone.forEach((terrain) => {
            //                 console.log(" [coloredABuildingOnHover] a zone neighbor object", terrain)
            //                 setColorOnMaterialArray(terrain, 0x000000)
            //             })
            //         }
                    
            //     }
            // }

           
       }
       hoveredObject = null; // Clear the hovered object
       return
   }
}



/**
 * @param {T} object3D
 * @param {*} color
 */
function setColorOnMaterialArray(object3D, color) {
        // Reset the emissive color of the previously hovered object
        if (object3D && Array.isArray(object3D.material)) {
            // Iterate over the array of MeshLambertMaterial objects
            object3D.material.filter((material) => isMaterialTypeFound(material, types)).forEach((material) => {
                if (material.emissive) {
                    // Setting color on material
                      // Reset to the original emissive color stored in userData
                      material.emissive.setHex(color)
                }
            });
        } else {
            if(!object3D.material) {
                console.warn("[coloredABuildingOnHover] [setColorOnMeshLambertMaterialArray] object3D has no material")
                return
            }

            if(!object3D.material.emissive) {
                console.warn("[coloredABuildingOnHover] [setColorOnMeshLambertMaterialArray] object3D.material has no emissive")
                return
            }

            if(isMaterialTypeFound(object3D.material, types) ) {
                // Setting color on mesh standard material
                // Reset to the original emissive color stored in userData
                object3D.material.emissive.setHex(color)
            }
           
        }
}



function setPropertiesOnMaterialArray(object3D, properties, instance = THREE.MeshLambertMaterial) {
    if (object3D && Array.isArray(object3D.material)) {
        object3D.material.filter((material) => material instanceof instance).forEach((material) => {
            Object.entries(properties).forEach(([key, value]) => {
                if (key in material) {
                    if (material[key] instanceof THREE.Color) {
                        material[key].set(value); // For color-like properties
                    } else {
                        material[key] = value; // For other properties
                    }
                }
            });
        });
    } else if (object3D?.material) {
        const material = object3D.material;
        Object.entries(properties).forEach(([key, value]) => {
            if (key in material) {
                if (material[key] instanceof THREE.Color) {
                    material[key].set(value);
                } else {
                    material[key] = value;
                }
            }
        });
    }
}


/**
 * Changes the emissive color of a zone when it is hovered over.
 * If the zone is already hovered, its color will be reset to the default color.
 * The function ensures that the original emissive color is stored and restored when needed.
 *
 * @param {Array} intersections - The array of intersections from raycasting, containing the objects intersected by the ray.
 * @param {number} [color=0x3333CC] - The color to set the emissive color to when the object is hovered. Defaults to red (`0xff0000`).
 */
export function coloredAZoneOnHover(intersections, color = 0x3333CC) {
   neighborsHoveredObjects
    if (intersections.length > 0) {
        // Zone hover processing

        const intersectedObject = intersections[0].object;

        if (intersectedObject !== hoveredObject) {
            // Zone hover object changed

            // Reset the emissive color of the previously hovered object
            if (hoveredObject && Array.isArray(hoveredObject.material)) {
                // Iterate over the array of MeshLambertMaterial objects
                hoveredObject.material.filter((material) => isMaterialTypeFound(material, types)).forEach((material) => {
                    if (material.emissive) {
                        // Zone material emissive processing
                 
                          // Reset to the original emissive color stored in userData
                          material.emissive.setHex(0x3333CC)
                    }
                });
            }

            // Set the new hovered object
            hoveredObject = intersectedObject;

                    // Store the original emissive color and material if not already stored
            if (!hoveredObject.userData.originalEmissive && Array.isArray(hoveredObject.material)) {
                // Get the RGB values from the first material's emissive color
                const emissiveColor = hoveredObject.material[0].emissive.getHex(); // Returns an object { r, g, b }
                // Emissive color processing
                // Store the RGB values in userData
                hoveredObject.userData.originalEmissive = emissiveColor;  // Store the original emissive color as RGB values in userData
                 
                // Clone the materials to store them
                hoveredObject.userData.originalMaterial = hoveredObject.material.map(material => material.clone()); // Store a clone of each material
            }

            // Change the emissive color to the specified color
            if (Array.isArray(hoveredObject.material)) {
                hoveredObject.material.forEach((material) => {
                    if (isMaterialTypeFound(material, types)  && material.emissive) {
                        // Zone material color change
                        material = material.clone(); // Clone the material for manipulation
                          // Reset to the original emissive color stored in userData
                          material.emissive.setHex(0x3333CC);
                    }
                });
            }
        }
    } else {
        // Reset the emissive color if no object is hovered
        if (hoveredObject && Array.isArray(hoveredObject.material)) {
            hoveredObject.material.forEach((material) => {
                if (isMaterialTypeFound(material, types)  && material.emissive) {
                    // Zone material color reset
                      // Reset to the original emissive color stored in userData
                      material.emissive.setHex(0x000000);
                }
            });
        }
        hoveredObject = null; // Clear the hovered object
    }
}

/**
 * Set and get a color value of a selected three js object3D
 * @param {THREE.Object3D} selectedObject - The selected object3D to set the color
 * @param hexValue
 * @returns {object : THREE.Object3D, hex: String, hsl : String, rgb : String, color: String, colors: Array<string>}
 */
export function handleColorOnSelectedObject(selectedObject, hexValue=0xff0000) {

    if(!selectedObject) {
        console.warn("No selected object suitable for handleColorOnSelectedObject")
        return
    }

    if(!selectedObject instanceof THREE.Object3D) {
        console.warn("Selected object is not an instance of THREE.Object3D")
        return
    }

    if(!selectedObject.userData) {
        console.warn("No selected object suitable for setHexOnSelectedObject")

        if(!selectedObject.userData.x || !selectedObject.userData.y) {
            console.warn("No x or y coordinates in selectedObject.userData")
            return
        }
        return
    }

    let { x, y, id } = selectedObject.userData;
    let hsl;
    let rgb;
    let hex;
    let color;

    let hexes = [];
    let colors = []

    selectedObject.traverse(function (node) {
        // Processing selected node
        
        /* Change some colors of the selected building */
        if(node.material) {

            if (Array.isArray(node.material)) {
                // Node has material array
                node.material.forEach((material) => {
                    // Processing node material
                    /* Ground of a building become red */
                    if (isMaterialTypeFound(material, types) ) {
                        // NO need to clone it here
                        // Mesh lambert material processing
                        material.emissive.setHex(hexValue) 
                        hex = material.emissive.getHexString();
                        color = material.emissive.getStyle();
                        colors.push(material.emissive.getStyle());
                        hexes.push(material.emissive.getHexString());
                    }
                });
            }

            /* A selected building have a transparent red added using emissive three js property */
            if(isMaterialTypeFound(node.material, types)) {
                // Mesh standard material processing
                // y is z in position key of the node
                // Processing mesh node
                const nodeX = node.position.x
                const nodeY = node.position.z
                if(nodeX === x && nodeY === y) {
                    node.material = node.material.clone();
                    if(node.material.emissive) {
                        node.material.emissive.setRGB(0.8, 0.2, 0.2); // red
                        hex = node.emissive?.getHexString();
                        color = node.material.emissive?.getStyle();
                    }
                 
                }
                
            }
        }
        

    })

    return { 
        object : selectedObject,
        hex: hex,
        hsl : hsl,
        rgb : rgb,
        color: color,
        colors: colors
    }
}


export function isMaterialTypeFound(material, types) {
    if (!Array.isArray(types)) {
        console.warn("The 'types' parameter should be an array of THREE material types.");
        return false;
    }

    // Check if the material is an instance of any type in the types array
    return types.some(type => material instanceof type);
}


export function resetHoveredObject(hoveredObject) {
    if (hoveredObject) {
        resetObjectColor(hoveredObject);
        hoveredObject = null;
    }
}

 const materials = {
        'roads': new THREE.MeshLambertMaterial({ map: textures['roads'], emissive: new THREE.Color(0.333, 0.333, 0.333) }),
        'grass' : new THREE.MeshLambertMaterial({ map: textures['grass'], color: new THREE.Color(0.333, 0.333, 0.333) }),
        'House-Red' : new THREE.MeshLambertMaterial({ color: new THREE.Color(0.999, 0.777, 0.333)})
    }

export function applyHoverColor(object, color, texture="") {
    // Applying hover color
    
    if(!object.userData.isBuilding && !object.name === 'grass') {
        object.material = materials[texture] || new THREE.MeshLambertMaterial
        object.material = object.material.clone();
        object.material.userData.id = object.name
    } 
   
    if (Array.isArray(object.material)) {
        console.warn(`[asset] applyHoverColor on material array ${object.name}`, object)
        
        object.material.forEach(material => {
            console.warn(`applyHoverColor on material: `, material)
            if (material.emissive) {
                console.warn(`applyHoverColor on material emissive: `, material)
                material.emissive.setHex(color);
            } else {
                console.warn(`${object.name} has no material emissive`, object)
            }
        });
    } else if (object.material.emissive) {
        console.warn(`[asset] applyHoverColor on material alone ${object.name}`)
        object.material.emissive.setHex(0xff0000);
    }
    // Hover color applied
}

export function resetObjectColor(object) {
    if (Array.isArray(object.material)) {
        object.material.forEach(material => {
            if (material.emissive) {
                material.emissive.setHex(0x000000); // Reset to default color
            }
        });
    } else if (object.material.emissive) {
        object.material.emissive.setHex(0x000000); // Reset to default color
    }
}

/**
 * Local-space bounding box of `object3D` — relative to the object itself,
 * ignoring its own position/rotation/scale (but including its children's),
 * so it's valid regardless of where/how the object is placed in the scene.
 * Cached on the object: geometry doesn't change after a mesh is placed.
 *
 * @param {THREE.Object3D} object3D
 * @returns {THREE.Box3}
 */
export function getLocalBoundingBox(object3D) {
    if (object3D.userData.__localBoundingBox) {
        return object3D.userData.__localBoundingBox;
    }
    object3D.updateWorldMatrix(true, false);
    const worldBox = new THREE.Box3().setFromObject(object3D);
    const inverse = new THREE.Matrix4().copy(object3D.matrixWorld).invert();
    const localBox = worldBox.clone().applyMatrix4(inverse);
    object3D.userData.__localBoundingBox = localBox;
    return localBox;
}

/**
 * Resolves a status-icon anchor to an actual local position on `mesh`,
 * regardless of which adapter/glb produced it — this is what lets a status
 * sprite (no-food, no-road, ...) land in the same relative spot on a
 * building no matter its real-world size (village_town vs. Kenney vs.
 * whatever comes next).
 *
 * `offset` is a FRACTION of the mesh's own bounding box, not an absolute
 * unit:
 *  - x/z: fraction of width/depth, relative to the box's horizontal center
 *    (negative = left/back, positive = right/front)
 *  - y: fraction of height, relative to the box's base (0 = ground, 1 = roof)
 *
 * @param {THREE.Object3D} mesh
 * @param {{x: number, y: number, z: number}} offset
 * @returns {{x: number, y: number, z: number}}
 */
export function resolveStatusIconPosition(mesh, offset) {
    const box = getLocalBoundingBox(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return {
        x: center.x + offset.x * size.x,
        y: box.min.y + offset.y * size.y,
        z: center.z + offset.z * size.z,
    };
}