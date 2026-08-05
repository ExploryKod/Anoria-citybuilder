import * as THREE from "three";

const loader = new THREE.TextureLoader();

export function loadTextures(path, flipY = false) {
    const texture = loader.load(path)
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1,1);
    texture.flipY = flipY;
    return texture;
}

export const textures = Object.freeze({
    'roads': loadTextures(`/resources/textures/grounds/ground_cobblestone5.png`),
    'grass': loadTextures(`/resources/textures/grounds/grass_rough2.png`),
    'decal': loadTextures(`/resources/textures/skies/plain_sky.jpg`),
    'no-roads': loadTextures(`/resources/textures/status/no-road.png`),
    'no-power': loadTextures(`/resources/textures/status/no-road.png`),
    'base' : loadTextures(`/resources/textures/maps/base.png`),
    'specular' : loadTextures(`/resources/textures/maps/specular.png`),
    'grid': loadTextures(`/resources/textures/maps/grid.png`),
    'nofood': loadTextures(`/resources/textures/status/nofood.png`, true),
    // Farm season sprites
    'grow-food': loadTextures(`/resources/textures/status/grow_food.png`, true),
    'harvest': loadTextures(`/resources/textures/status/harvest.png`, true),
    'sell-food': loadTextures(`/resources/textures/status/sell_food.png`, true),
    // Market buying sprite
    'isBuying': loadTextures(`/resources/textures/status/isBuying.png`, true),
    // Windmill collecting sprite (reuse isBuying icon)
    'isCollecting': loadTextures(`/resources/textures/status/isBuying.png`, true),
    // No worker sprite (black) - shown when building has no employees
    'no-work': loadTextures(`/resources/textures/status/no-work.png`, true)
})

// Economy catalog (assetsPrices, type lists) → src/shared/building-catalog/

// Mapping of GLB mesh names to tool names
// From the GLTF export, we have mesh names like:
// - Windmill_Material005_0 → becomes "Windmill" (no number)
// - Windmill001_Material005_0 → becomes "Windmill001"
// - Windmill002_Material005_0 → becomes "Windmill002"
// - Windmill003_Material005_0 → becomes "Windmill003"
// We map all these to "Windmill-001" for consistency
export const meshNameMapping = {
    // Windmill variants
    'Windmill': 'Windmill-001',
    'Windmill001': 'Windmill-001',
    'Windmill002': 'Windmill-001',
    'Windmill003': 'Windmill-001',
    
    // Barn variants
    'Barn': 'Barn-001',
    'Barn001': 'Barn-001',
    
    // Well variants
    'Well': 'Well-001',
    'Well001': 'Well-001',
    
    // Fountain variants
    'Fountain': 'Fountain-001',
    'Fountain001': 'Fountain-001',
    
    // Streetlight variants (001-017 all map to Streetlight-001)
    'Streetlight': 'Streetlight-001',
    'Streetlight001': 'Streetlight-001',
    'Streetlight002': 'Streetlight-001',
    'Streetlight003': 'Streetlight-001',
    'Streetlight004': 'Streetlight-001',
    'Streetlight005': 'Streetlight-001',
    'Streetlight006': 'Streetlight-001',
    'Streetlight007': 'Streetlight-001',
    'Streetlight008': 'Streetlight-001',
    'Streetlight009': 'Streetlight-001',
    'Streetlight010': 'Streetlight-001',
    'Streetlight011': 'Streetlight-001',
    'Streetlight012': 'Streetlight-001',
    'Streetlight013': 'Streetlight-001',
    'Streetlight014': 'Streetlight-001',
    'Streetlight016': 'Streetlight-001',
    'Streetlight017': 'Streetlight-001',
    
    // Church002 discarded (broken duplicate of Chapel)

    // House.003 discarded (Y-up stray; use House_Blue / House_Red / House_Purple)
    
    // House 2 Story variants
    'House_2Story': 'House-2Story',
    'House_2Story_Purple': 'House-2Story',
    'House_2Story_Purple001': 'House-2Story',
    'House_2Story_Purple002': 'House-2Story',
    'House_2Story_Purple003': 'House-2Story',
    'House_2Story_Purple004': 'House-2Story',
    'House_2Story_Purple005': 'House-2Story',
    'House_2Story_Purple006': 'House-2Story',
    'House_2Story_Purple007': 'House-2Story',
    'House_2Story_Purple008': 'House-2Story',
    'House_2Story_Purple009': 'House-2Story',
    
    // Tree variants - Pine
    'Tree_Pine': 'Tree-Pine-001',
    'Tree_Pine001': 'Tree-Pine-001',
    'Tree_Pine002': 'Tree-Pine-001',
    'Tree_Pine003': 'Tree-Pine-001',
    'Tree_Pine004': 'Tree-Pine-001',
    'Tree_Pine005': 'Tree-Pine-001',
    'Tree_Pine006': 'Tree-Pine-001',
    'Tree_Pine007': 'Tree-Pine-001',
    'Tree_Pine008': 'Tree-Pine-001',
    'Tree_Pine009': 'Tree-Pine-001',
    'Tree_Pine010': 'Tree-Pine-001',
    'Tree_Pine011': 'Tree-Pine-001',
    'Tree_Pine012': 'Tree-Pine-001',
    'Tree_Pine013': 'Tree-Pine-001',
    'Tree_Pine014': 'Tree-Pine-001',
    'Tree_Pine015': 'Tree-Pine-001',
    'Tree_Pine016': 'Tree-Pine-001',
    'Tree_Pine017': 'Tree-Pine-001',
    'Tree_Pine018': 'Tree-Pine-001',
    'Tree_Pine019': 'Tree-Pine-001',
    'Tree_Pine020': 'Tree-Pine-001',
    'Tree_Pine021': 'Tree-Pine-001',
    'Tree_Pine022': 'Tree-Pine-001',
    'Tree_Pine023': 'Tree-Pine-001',
    'Tree_Pine024': 'Tree-Pine-001',
    'Tree_Pine025': 'Tree-Pine-001',
    'Tree_Pine026': 'Tree-Pine-001',
    'Tree_Pine027': 'Tree-Pine-001',
    'Tree_Pine028': 'Tree-Pine-001',
    'Tree_Pine029': 'Tree-Pine-001',
    'Tree_Pine030': 'Tree-Pine-001',
    'Tree_Pine031': 'Tree-Pine-001',
    'Tree_Pine032': 'Tree-Pine-001',
    'Tree_Pine033': 'Tree-Pine-001',
    'Tree_Pine034': 'Tree-Pine-001',
    'Tree_Pine035': 'Tree-Pine-001',
    'Tree_Pine036': 'Tree-Pine-001',
    'Tree_Pine037': 'Tree-Pine-001',
    'Tree_Pine038': 'Tree-Pine-001',
    'Tree_Pine039': 'Tree-Pine-001',
    'Tree_Pine040': 'Tree-Pine-001',
    'Tree_Pine041': 'Tree-Pine-001',
    'Tree_Pine042': 'Tree-Pine-001',
    'Tree_Pine043': 'Tree-Pine-001',
    
    // Tree variants - Square
    'Tree_Square': 'Tree-Square-001',
    'Tree_Square001': 'Tree-Square-001',
    'Tree_Square002': 'Tree-Square-001',
    'Tree_Square003': 'Tree-Square-001',
    'Tree_Square004': 'Tree-Square-001',
    'TreeSquare005': 'Tree-Square-001',
    'TreeSquare008': 'Tree-Square-001',
    'TreeSquare009': 'Tree-Square-001',
    'TreeSquare010': 'Tree-Square-001',
    
    // Tree variants - Tall
    'Tree_Tall': 'Tree-Tall-001',
    'TreeTall001': 'Tree-Tall-001',
    'TreeTall002': 'Tree-Tall-001',
    'TreeTall003': 'Tree-Tall-001',
    'TreeTall004': 'Tree-Tall-001',
    'TreeTall005': 'Tree-Tall-001',
    'TreeTall006': 'Tree-Tall-001',
    'TreeTall007': 'Tree-Tall-001',
    'TreeTall008': 'Tree-Tall-001',
    'TreeTall009': 'Tree-Tall-001',
    'TreeTall010': 'Tree-Tall-001',
    'TreeTall011': 'Tree-Tall-001',
    'TreeTall012': 'Tree-Tall-001',
    'TreeTall013': 'Tree-Tall-001',
    'TreeTall014': 'Tree-Tall-001',
    'TreeTall015': 'Tree-Tall-001',
    'TreeTall016': 'Tree-Tall-001',
    'TreeTall017': 'Tree-Tall-001',
    'TreeTall018': 'Tree-Tall-001',
    
    // Tree type mappings (descriptive names to asset names)
    'Tree-Sapin': 'Tree-Pine-001',
    'Tree-Arbuste': 'Tree-Square-001',
    'Tree-Chene': 'Tree-Tall-001',
    
    // Boulder variants (all map to Boulder-001)
    'Boulder': 'Boulder-001',
    'Boulder001': 'Boulder-001',
    'Boulder002': 'Boulder-001',
    'Boulder003': 'Boulder-001',
    'Boulder004': 'Boulder-001',
    'Boulder005': 'Boulder-001',
    'Boulder006': 'Boulder-001',
    'Boulder007': 'Boulder-001',
    'Boulder008': 'Boulder-001',
    'Boulder009': 'Boulder-001',
    'Boulder010': 'Boulder-001',
    
    // Crate variants
    'Crate': 'Crate-001',
    'Crate001': 'Crate-001',
    'Crate002': 'Crate-001',
    'Crate003': 'Crate-001',
    'Crate004': 'Crate-001',
    'Crate005': 'Crate-001',
    'Crate006': 'Crate-001',
    'Crate007': 'Crate-001',
    'Crate008': 'Crate-001',
    'Crate009': 'Crate-001',
    'Crate010': 'Crate-001',
    'Crate011': 'Crate-001',
    'Crate012': 'Crate-001',
    'Crate013': 'Crate-001',
    'Crate014': 'Crate-001',
    'Crate015': 'Crate-001',
    'Crate016': 'Crate-001',
    'Crate017': 'Crate-001',
    'Crate018': 'Crate-001',
    'Crate019': 'Crate-001',
    'Crate020': 'Crate-001',
    'Crate021': 'Crate-001',
    'Crate022': 'Crate-001',
    'Crate023': 'Crate-001',
    'Crate024': 'Crate-001',
    'Crate025': 'Crate-001',
    'Crate026': 'Crate-001',
    'Crate027': 'Crate-001',
    'Crate028': 'Crate-001',
    'Crate029': 'Crate-001',
    'Crate030': 'Crate-001',
    'Crate031': 'Crate-001',
    'Crate032': 'Crate-001',
    'Crate033': 'Crate-001',
    'Crate034': 'Crate-001',
    'Crate035': 'Crate-001',
    
    // StonePath variants (all map to StonePath-001 for roads)
    'StonePath': 'StonePath-001',
    'StonePath001': 'StonePath-001',
    'StonePath002': 'StonePath-001',
    'StonePath003': 'StonePath-001',
    'StonePath004': 'StonePath-001',
    'StonePath005': 'StonePath-001',
    'StonePath006': 'StonePath-001',
    'StonePath007': 'StonePath-001',
    'StonePath008': 'StonePath-001',
    'StonePath009': 'StonePath-001',

    // Markets by color
    'Market_Stall_Blue': 'Market-Stall-Blue',
    'Market_Stall_Red': 'Market-Stall-Red',

    // Public
    'Chapel': 'Chapel',
    // Church002 intentionally omitted — broken duplicate of Chapel

    // Farm props
    'Hay_Bale': 'Hay-Bale',
    'Hay_Cart': 'Hay-Cart',
    'Hay_Pile': 'Hay-Pile',

    // Infra surfaces / props
    'Fence': 'Fence-001',
    'Pond': 'Pond-001',
    'Plane001': 'Plane-001',
    'Plane004': 'Plane-004',
    'Plane007': 'Plane-007',
    'Well': 'Well-001',
    'Fountain': 'Fountain-001',
    'Streetlight': 'Streetlight-001',

    // Wheat silos (all Cylinder* → one tool)
    'Cylinder007': 'Cylinder',
    'Cylinder008': 'Cylinder',
    'Cylinder009': 'Cylinder',
    'Cylinder011': 'Cylinder',
    'Cylinder012': 'Cylinder',
    'Cylinder013': 'Cylinder',

    // Cube / Sphere (Cube* → single Cube tool)
    'Cube': 'Cube',
    'Sphere001': 'Sphere-001',
    'Sphere002': 'Sphere-002',

    // Decoration
    'Bench': 'Bench',
    'Picnic_Table': 'Picnic-Table',
    'Potted_Bush': 'Potted-Bush',
    'Daisy': 'Daisy',
    'Shroom': 'Shroom',
    'Arch': 'Arch',
    'Obelisk': 'Obelisk',
    'Pillar': 'Pillar',
    'Garland': 'Garland',
    'Barrell': 'Barrell',

    // Cemetery
    'Grave_1': 'Grave-1',
    'Grave_2': 'Grave-2',
    'Tombstone_1': 'Tombstone-1',
    'Tombstone_2': 'Tombstone-2',
    'Tombstone_3': 'Tombstone-3',
    'Tomb': 'Tomb',
    'Coffin': 'Coffin',

    // Industry
    'Barn': 'Barn-001',
    'Windmill': 'Windmill-001',
};
