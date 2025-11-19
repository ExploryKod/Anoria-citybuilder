# Guide d'Optimisation Three.js et WebGL

## 🚨 Problèmes Critiques Identifiés

### 1. **BUG MAJEUR : Lumières Multipliées** ⚠️
**Problème** : `setUpLights()` est appelé **16 fois** pour une ville 16×16 (dans la boucle de création du terrain).

**Impact** :
- 16 × 1 AmbientLight = **16 lumières ambiantes**
- 16 × 3 DirectionalLight = **48 lumières directionnelles**
- 16 × 1 HemisphereLight = **16 lumières hémisphériques**
- **Total : 80 lumières** pour une ville 16×16 !

**Coût GPU** : Chaque lumière directionnelle avec ombres = calculs de shadow mapping très coûteux.

**Solution** : Déplacer `setUpLights()` **en dehors** de la boucle, l'appeler **une seule fois** après l'initialisation du terrain.

---

## 📊 Comprendre les Limites WebGL

### Texture Units (Unités de Texture)
- **Limite standard** : 16-32 unités de texture par matériau
- **Votre code** : Utilise déjà des matériaux partagés (bon !)
- **Problème** : Si vous clonez des matériaux, chaque clone consomme des unités

### Vertex Attributes (Attributs de Sommets)
- **Limite minimale** : 8 attributs
- **Limite typique** : 16 attributs
- **Impact** : Limite le nombre de données par sommet (position, normale, UV, couleur, etc.)

### Texture Size (Taille de Texture)
- **Limite minimale** : 2048×2048 px
- **Limite typique** : 4096×4096 px (intégré) à 16384×16384 px (dédié)
- **Impact** : Textures trop grandes = mémoire GPU saturée

### GPU Memory (Mémoire GPU)
- **Intégré** : 256MB - 2GB (partagé avec RAM système)
- **Dédié** : 2GB - 24GB+
- **Impact** : Limite le nombre d'objets/textures en mémoire

---

## 🎯 Optimisations Prioritaires

### 1. **Instancing (Instanciation)** ⭐⭐⭐
**Problème** : Chaque bâtiment = 1 draw call séparé.

**Solution** : Utiliser `THREE.InstancedMesh` pour les bâtiments répétitifs.

```javascript
// Exemple : Instancier les maisons identiques
const houseGeometry = /* géométrie de base */;
const houseMaterial = /* matériau partagé */;
const instancedMesh = new THREE.InstancedMesh(houseGeometry, houseMaterial, 100);

// Positionner chaque instance
for (let i = 0; i < 100; i++) {
    const matrix = new THREE.Matrix4();
    matrix.setPosition(x, y, z);
    instancedMesh.setMatrixAt(i, matrix);
}

scene.add(instancedMesh);
```

**Gain** : 100 maisons = 1 draw call au lieu de 100.

---

### 2. **LOD (Level of Detail)** ⭐⭐⭐
**Problème** : Tous les objets sont rendus avec le même niveau de détail, même ceux loin de la caméra.

**Solution** : Créer plusieurs versions de chaque modèle (haute/moyenne/basse qualité).

```javascript
import { LOD } from 'three';

const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);    // 0-50 unités
lod.addLevel(mediumDetailMesh, 50); // 50-100 unités
lod.addLevel(lowDetailMesh, 100);   // 100+ unités

scene.add(lod);
```

**Gain** : Réduction drastique du nombre de polygones rendus.

---

### 3. **Frustum Culling Optimisé** ⭐⭐
**Problème** : Three.js fait déjà du frustum culling, mais vous pouvez l'optimiser.

**Solution** : Grouper les objets par zones et désactiver le rendu des zones hors caméra.

```javascript
// Créer des groupes par zone
const zoneGroups = [];
for (let x = 0; x < city.size; x += 4) {
    for (let y = 0; y < city.size; y += 4) {
        const group = new THREE.Group();
        group.name = `zone_${x}_${y}`;
        // Ajouter les bâtiments de cette zone
        zoneGroups.push(group);
        scene.add(group);
    }
}

// Dans la boucle de rendu
function updateVisibleZones(camera) {
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        )
    );
    
    zoneGroups.forEach(group => {
        const box = new THREE.Box3().setFromObject(group);
        group.visible = frustum.intersectsBox(box);
    });
}
```

---

### 4. **Raycasting Optimisé** ⭐⭐
**Problème** : `raycaster.intersectObjects(scene.children, false)` teste **tous** les objets à chaque frame.

**Solution** : Utiliser des groupes ou des octrees pour limiter les tests.

```javascript
// Créer un groupe pour les objets interactifs seulement
const interactiveObjects = new THREE.Group();
interactiveObjects.name = 'interactive';
scene.add(interactiveObjects);

// Ajouter seulement les bâtiments interactifs
buildings.forEach(building => {
    if (building.userData.interactive) {
        interactiveObjects.add(building);
    }
});

// Raycast seulement sur les objets interactifs
const intersections = raycaster.intersectObjects(
    interactiveObjects.children, 
    false
);
```

**Gain** : Réduction de 90%+ des tests de collision.

---

### 5. **Texture Compression** ⭐⭐
**Problème** : Textures non compressées = mémoire GPU saturée.

**Solution** : Utiliser des formats compressés (KTX2, Basis Universal).

```javascript
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { BasisTextureLoader } from 'three/addons/loaders/BasisTextureLoader.js';

// KTX2 (meilleure compression)
const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('/path/to/basis/');
ktx2Loader.load('texture.ktx2', (texture) => {
    material.map = texture;
});

// Basis Universal (fallback)
const basisLoader = new BasisTextureLoader();
basisLoader.setTranscoderPath('/path/to/basis/');
basisLoader.load('texture.basis', (texture) => {
    material.map = texture;
});
```

**Gain** : Réduction de 50-80% de la mémoire texture.

---

### 6. **Geometry Merging (Fusion de Géométries)** ⭐
**Problème** : Beaucoup de petits meshes = beaucoup de draw calls.

**Solution** : Fusionner les géométries statiques.

```javascript
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';

const geometries = [];
buildings.forEach(building => {
    building.traverse(child => {
        if (child instanceof THREE.Mesh) {
            const geometry = child.geometry.clone();
            geometry.applyMatrix4(child.matrixWorld);
            geometries.push(geometry);
        }
    });
});

const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
const mergedMesh = new THREE.Mesh(mergedGeometry, sharedMaterial);
scene.add(mergedMesh);
```

**Attention** : Ne fonctionne que pour les objets statiques (pas de mouvement).

---

### 7. **Material Pooling (Pool de Matériaux)** ⭐
**Problème** : Création/destruction de matériaux = allocations mémoire.

**Solution** : Réutiliser les matériaux existants.

```javascript
class MaterialPool {
    constructor() {
        this.pool = new Map();
    }
    
    getMaterial(type, texture) {
        const key = `${type}_${texture.uuid}`;
        if (!this.pool.has(key)) {
            this.pool.set(key, new THREE.MeshLambertMaterial({
                map: texture
            }));
        }
        return this.pool.get(key);
    }
    
    dispose() {
        this.pool.forEach(material => material.dispose());
        this.pool.clear();
    }
}
```

---

### 8. **Render Target Optimization** ⭐
**Problème** : Rendu à chaque frame même si rien n'a changé.

**Solution** : Ne rendre que quand nécessaire.

```javascript
let needsRender = true;

function animate() {
    requestAnimationFrame(animate);
    
    if (needsRender) {
        renderer.render(scene, camera);
        needsRender = false;
    }
}

// Marquer comme nécessaire seulement quand quelque chose change
function onBuildingAdded() {
    needsRender = true;
}
```

---

## 🔧 Optimisations Spécifiques à Votre Code

### 1. **Corriger setUpLights()**
```javascript
// ❌ MAUVAIS (actuel)
for(let x = 0; x < city.size; x++) {
    // ...
    setUpLights(city.size); // Appelé 16 fois !
}

// ✅ BON
for(let x = 0; x < city.size; x++) {
    // Créer le terrain seulement
}

// Appeler setUpLights UNE SEULE FOIS après la boucle
setUpLights(city.size);
```

### 2. **Optimiser le Raycasting**
```javascript
// ❌ MAUVAIS (actuel)
const intersections = raycaster.intersectObjects(scene.children, false);

// ✅ BON
// Créer un groupe pour les objets interactifs
const interactiveGroup = new THREE.Group();
interactiveGroup.name = 'interactive';
scene.add(interactiveGroup);

// Ajouter seulement les bâtiments/terrain interactifs
buildings.forEach(building => {
    if (building) {
        interactiveGroup.add(building);
    }
});

// Raycast seulement sur le groupe interactif
const intersections = raycaster.intersectObjects(
    interactiveGroup.children, 
    false
);
```

### 3. **Réduire les Ombres**
```javascript
// Réduire la résolution des shadow maps
dirLight1.shadow.mapSize.width = 512;  // Au lieu de 1024
dirLight1.shadow.mapSize.height = 512;

// Utiliser BasicShadowMap au lieu de PCFSoftShadowMap (moins coûteux)
renderer.shadowMap.type = THREE.BasicShadowMap; // Plus rapide
// ou
renderer.shadowMap.type = THREE.PCFShadowMap; // Compromis qualité/performance
```

### 4. **Désactiver les Ombres pour les Objets Lointains**
```javascript
function updateShadowCasting(camera) {
    buildings.forEach(building => {
        if (building) {
            const distance = camera.position.distanceTo(building.position);
            // Désactiver les ombres pour les objets > 50 unités
            building.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = distance < 50;
                    child.receiveShadow = distance < 50;
                }
            });
        }
    });
}
```

---

## 📈 Métriques de Performance

### Comment Mesurer

```javascript
// Ajouter des statistiques de performance
import Stats from 'three/addons/libs/stats.module.js';

const stats = new Stats();
document.body.appendChild(stats.dom);

function animate() {
    stats.begin();
    renderer.render(scene, camera);
    stats.end();
    requestAnimationFrame(animate);
}

// Afficher le nombre d'objets rendus
console.log('Objects:', scene.children.length);
console.log('Draw calls:', renderer.info.render.calls);
console.log('Triangles:', renderer.info.render.triangles);
console.log('Textures:', renderer.info.memory.textures);
```

### Objectifs de Performance

- **FPS** : 60 FPS sur machines moyennes (30 FPS minimum acceptable)
- **Draw calls** : < 100 pour une ville 16×16
- **Triangles** : < 100,000 visibles simultanément
- **Textures** : < 50 textures actives
- **Mémoire GPU** : < 500MB pour une ville 16×16

---

## 🛠️ Outils de Debug

### 1. **Three.js Inspector**
```javascript
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const gui = new GUI();
gui.add(renderer.info, 'calls').name('Draw Calls');
gui.add(renderer.info, 'triangles').name('Triangles');
gui.add(renderer.info, 'points').name('Points');
gui.add(renderer.info.memory, 'geometries').name('Geometries');
gui.add(renderer.info.memory, 'textures').name('Textures');
```

### 2. **Chrome DevTools**
- **Performance tab** : Enregistrer une session et analyser
- **Memory tab** : Vérifier les fuites mémoire
- **Rendering tab** : Activer "Paint flashing" et "Layer borders"

### 3. **WebGL Inspector**
Extension Chrome pour inspecter les appels WebGL.

---

## 📚 Ressources

- [Three.js Performance Tips](https://threejs.org/manual/#en/performance)
- [WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [GPU Performance Optimization](https://web.dev/gpu-performance/)
- [Three.js Examples - Instancing](https://threejs.org/examples/?q=instanc)

---

## ✅ Checklist d'Optimisation

- [ ] Corriger le bug des lumières multipliées
- [ ] Implémenter l'instancing pour les bâtiments répétitifs
- [ ] Ajouter le LOD pour les objets lointains
- [ ] Optimiser le raycasting (groupe interactif)
- [ ] Réduire la résolution des shadow maps
- [ ] Désactiver les ombres pour les objets lointains
- [ ] Compresser les textures (KTX2/Basis)
- [ ] Fusionner les géométries statiques
- [ ] Ajouter des statistiques de performance
- [ ] Tester sur machines tierces

---

**Dernière mise à jour** : 11 novembre 2025

