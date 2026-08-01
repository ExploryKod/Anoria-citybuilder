# Guide de Refactorisation de scene.js

Ce guide explique comment utiliser les nouveaux modules managers pour refactorer `scene.js`.

## Modules créés

1. **CitizenManager.js** - Gestion complète des citoyens (animations, spawn, pathfinding)
2. **CitizenPathfinding.js** - Helpers pour le pathfinding des citoyens
3. **LightingManager.js** - Configuration des lumières
4. **BackdropManager.js** - Gestion du backdrop et du ciel
5. **DecorativeVillageManager.js** - Création du village décoratif
6. **PerformanceManager.js** - Optimisations (frustum culling, shadow casting)
7. **BudgetProcessor.js** - Traitement budgétaire

## Exemple d'intégration dans scene.js

### 1. Imports en haut du fichier

```javascript
import { CitizenManager, CitizenData } from './managers/CitizenManager.js';
import { CitizenPathfinding } from './managers/CitizenPathfinding.js';
import { LightingManager } from './managers/LightingManager.js';
import { BackdropManager } from './managers/BackdropManager.js';
import { DecorativeVillageManager } from './managers/DecorativeVillageManager.js';
import { PerformanceManager } from './managers/PerformanceManager.js';
import { BudgetProcessor } from './managers/BudgetProcessor.js';
```

### 2. Initialisation dans createScene()

```javascript
export function createScene(gameStore, assetManager, parcelsOption, supplyOption, housingOption) {
    const scene = new THREE.Scene();
    // ... autres initialisations ...
    
    // Créer les managers
    const citizenManager = new CitizenManager(scene, assetManager);
    const lightingManager = new LightingManager(scene);
    const backdropManager = new BackdropManager(scene);
    const decorativeVillageManager = new DecorativeVillageManager(scene, assetManager);
    const budgetProcessor = new BudgetProcessor();
    
    // Initialiser les managers
    citizenManager.initialize();
    
    // ... reste du code ...
}
```

### 3. Dans initialize()

```javascript
async function initialize(city) {
    // ... code existant ...
    
    // Remplacer setUpLights(city.size) par:
    lightingManager.setUpLights(city.size);
    
    // Remplacer createDecorativeVillage(citySize) par:
    decorativeVillageManager.createDecorativeVillage(citySize);
    
    // Remplacer le reset des citoyens par:
    citizenManager.reset();
    citizenManager.setCitySize(citySize);
    
    // Initialiser le pathfinding
    const pathfinding = new CitizenPathfinding(buildings, terrain);
    
    // Initialiser le performance manager
    const performanceManager = new PerformanceManager(scene, camera, zoneGroups, buildings);
    
    // ... reste du code ...
}
```

### 4. Dans update()

```javascript
async function update(city, time=0) {
    // ... code existant pour les bâtiments ...
    
    // Remplacer le calcul des building counts par:
    const { buildingCounts, maintenanceBreakdown } = budgetProcessor.calculateBuildingCounts(city, buildings);
    
    // Remplacer toute la section budget par:
    await budgetProcessor.processBudget(time, totalPop, buildingCounts, maintenanceBreakdown);
    
    // Remplacer la gestion des citoyens par:
    const currentPopulation = await getCityTotalPopulation();
    await citizenManager.updateCitizens(
        currentPopulation, 
        city, 
        pathfinding.findBorderRoads.bind(pathfinding),
        pathfinding.createRoadPath.bind(pathfinding),
        (citizen) => pathfinding.recalculateCitizenPath(citizen, citizenManager),
        pathfinding.validatePath.bind(pathfinding)
    );
    
    // ... reste du code ...
}
```

Import requis en tête de `scene.js` :

```javascript
import { getCityTotalPopulation } from '../acl/housing.js';
```

### 5. Dans draw()

```javascript
function draw() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;
    
    // Remplacer updateCitizen par:
    citizenManager.updateAllCitizens(
        deltaTime,
        city,
        pathfinding.isRoadTile.bind(pathfinding),
        pathfinding.hasBuilding.bind(pathfinding),
        pathfinding.worldToTile.bind(pathfinding),
        pathfinding.getAdjacentRoads.bind(pathfinding),
        pathfinding.createRoadPath.bind(pathfinding),
        (citizen) => pathfinding.recalculateCitizenPath(citizen, citizenManager),
        pathfinding.validatePath.bind(pathfinding)
    );
    
    updateFocusedObject();
    
    // Remplacer updateFrustumCulling() et updateShadowCasting() par:
    performanceManager.updateFrustumCulling();
    performanceManager.updateShadowCasting(50);
    
    renderer.render(scene, camera.camera);
    logPerformanceStats();
}
```

### 6. Fonctions pauseCitizen et resumeCitizen

```javascript
function pauseCitizen() {
    citizenManager.pauseCitizens();
}

function resumeCitizen() {
    citizenManager.resumeCitizens();
}
```

## Code à supprimer de scene.js

Une fois les modules intégrés, vous pouvez supprimer :

1. **CitizenData class** (lignes ~213-229) - Maintenant dans CitizenManager.js
2. **Toutes les fonctions citoyens** :
   - `loadCitizenAnimations()` 
   - `loadCitizenCoolAnimations()`
   - `getCitizenAnimations()`
   - `switchCitizenAnimation()`
   - `createCitizenInstance()`
   - `spawnCitizenCharacter()`
   - `hideCitizenCharacter()`
   - `updateCitizen()`
   - `recalculateCitizenPath()`
   - `createRoadPath()`
   - `validatePath()`
   - `isRoadTile()`
   - `hasBuilding()`
   - `getAdjacentRoads()`
   - `findBorderRoads()`
   - `worldToTile()`

3. **setUpLights()** (lignes ~2557-2640) - Maintenant dans LightingManager.js

4. **createDecorativeVillage()** (lignes ~3904-4263) - Maintenant dans DecorativeVillageManager.js

5. **addBackdrop()** (lignes ~4265-4323) - Maintenant dans BackdropManager.js

6. **Toute la logique budget** dans `update()` (lignes ~2113-2336) - Maintenant dans BudgetProcessor.js

7. **updateFrustumCulling()** et **updateShadowCasting()** - Maintenant dans PerformanceManager.js

8. **showCleanupNotification()** et **showCleanupNotificationOnce()** - Maintenant dans BudgetProcessor.js

## Variables à conserver dans scene.js

- `terrain`, `buildings` - Nécessaires pour le pathfinding et autres opérations
- `zoneGroups` - Nécessaire pour PerformanceManager
- `currentCitySize` - Nécessaire pour plusieurs managers
- Variables de gameplay comme `delay`

## Notes importantes

1. **CitizenPathfinding** doit être recréé à chaque `initialize()` car il dépend de `buildings` et `terrain` qui changent.

2. **PerformanceManager** doit être recréé si `zoneGroups` ou `buildings` changent.

3. Les managers sont des instances, donc ils conservent leur état entre les appels.

4. Certaines fonctions comme `findBorderRoads` doivent être bindées pour conserver le contexte `this`.

## Résultat attendu

Après refactorisation, `scene.js` devrait passer de ~4800 lignes à environ ~2000-2500 lignes, en gardant uniquement :
- La logique de base de la scène
- La gestion des bâtiments dans `update()`
- Les événements d'input
- La coordination entre les managers
