# Tests - À implémenter et difficultés techniques

## 📊 État actuel

**Statistiques globales :**
- ✅ **359 tests passent** sur 362
- ⚠️ **3 tests échouent** (BudgetManager - problème de logique métier)
- ✅ **177 nouveaux tests** créés (92 modules + 46 HousesStore + 20 utils + 18 FoodDistributionService)

**Tests implémentés :**
- ✅ TimeManager (33 tests)
- ✅ EmployeeHelper (39 tests)
- ✅ ModuleHelper (31 tests)
- ✅ utils (30 tests)
- ✅ config (29 tests)
- ✅ **FoodModule (32 tests)** 🆕
- ✅ **Parcels road access** (behavior tests, `RoadAccessModule` supprimé)
- ✅ **EmploymentModule (30 tests)** 🆕
- ✅ EmployeeHelper.localStorage (8 tests)
- ✅ **HousesStore (46 tests)** 🆕
- ✅ **FoodDistributionService (18 tests)** 🆕
- ✅ BudgetManager (13 tests passent, 3 échouent)

## 📋 Tests non implémentés

### Services (nécessitent mocking IndexedDB)

#### FoodDistributionService ✅ **IMPLÉMENTÉ (partiel)**
- **Fichier** : `src/js/game/services/FoodDistributionService.js`
- **Tests** : `tests/FoodDistributionService.test.js` (18 tests)
- **Fonctionnalités testées** :
  - ✅ `calculateDistance()` - Distance Manhattan (5 tests)
  - ✅ `findHousesInRange()` - Filtrage par distance (5 tests)
  - ✅ `processMarket()` - Logique principale (4 tests)
  - ✅ `simulate()` - Orchestration globale (4 tests)
- **Fonctionnalités non testées** (complexes, nécessitent structures complètes) :
  - ⚠️ `collectFoodFromFarms()` - Collecte depuis fermes (stocks multiples, saisons)
  - ⚠️ `distributeFoodToHouses()` - Distribution vers maisons (stocks multiples, saisons)
  - ⚠️ `updateHousesMarketDistanceStatus()` - Détection distance marché
- **Statut** : ✅ 18 tests passent (tests de base)
- **Notes** : Tests de base créés. Tests d'intégration complets (ferme → marché → maison) à ajouter si nécessaire. Utilise le vrai TimeManager avec contrôle via paramètre `time`.

#### EmploymentDistributionService
- **Fichier** : `src/js/game/services/EmploymentDistributionService.js`
- **Fonctionnalités à tester** :
  - Distribution des travailleurs par priorité de secteur
  - Tri des bâtiments par priorité
  - Calcul des besoins en employés
  - Attribution des travailleurs disponibles
- **Difficulté** : ⚠️ Moyenne
  - Nécessite de mocker `HousesStore`
  - Nécessite de mocker `localStorage` pour les priorités
  - Logique de tri et d'allocation complexe

#### EmploymentPriorityService
- **Fichier** : `src/js/game/services/EmploymentPriorityService.js`
- **Fonctionnalités à tester** :
  - Mise à jour des priorités de secteur
  - Système de swap des priorités (Caesar 3 style)
  - Synchronisation localStorage ↔ IndexedDB
- **Difficulté** : ⚠️ Moyenne
  - Nécessite de mocker `localStorage` et `HousesStore`
  - Logique de swap complexe

#### WindmillService
- **Fichier** : `src/js/game/services/WindmillService.js`
- **Fonctionnalités à tester** :
  - Collecte de nourriture depuis les fermes
  - Vérification de l'accès routier
  - Vérification des employés
  - Gestion de `isCollecting`
- **Difficulté** : ⚠️ Moyenne
  - Nécessite de mocker `HousesStore`
  - Logique de collecte et de stockage

#### RoadConnectivityService
- **Fichier** : `src/js/game/services/RoadConnectivityService.js`
- **Fonctionnalités à tester** :
  - Vérification de la connectivité routière
  - Détection des bâtiments isolés
  - Calcul des chemins routiers
- **Difficulté** : ⚠️ Moyenne à Élevée
  - Nécessite de mocker `HousesStore` et structures de ville
  - Logique de graphe/parcours complexe

#### RandomEventsService
- **Fichier** : `src/js/game/services/RandomEventsService.js`
- **Fonctionnalités à tester** :
  - Génération d'événements aléatoires
  - Application des effets (ouragan, inondation)
  - Probabilités et déclenchements
- **Difficulté** : ⚠️ Moyenne
  - Nécessite de mocker le générateur aléatoire
  - Tests de probabilités (nécessite plusieurs runs)

### Modules (plus simples, fonctions pures)

#### FoodModule ✅ **IMPLÉMENTÉ**
- **Fichier** : `src/js/game/modules/FoodModule.js`
- **Tests** : `tests/FoodModule.test.js` (32 tests)
- **Fonctionnalités testées** :
  - ✅ `updateFromStocks()` - Mise à jour des stocks et population
  - ✅ `getTotalFood()` - Calcul du total (priorité au champ "food")
  - ✅ `hasFood()` - Vérification de disponibilité
  - ✅ `getNetFood()` - Bilan nourriture/population (jamais négatif)
  - ✅ `meetsFoodGoal()` - Objectif pour évolution palace (pop > 5 ET food > pop * 2)
  - ✅ `isInsufficient()` - Détection de famine (pop >= 2 ET food < pop)
  - ✅ `toHTML()` - Génération HTML pour les panneaux d'info
- **Statut** : ✅ 32 tests passent
- **Notes** : Fonctions pures, pas de dépendances externes. Tests complets avec cas limites.

#### RoadAccess (BC Parcels) ✅ **MIGRÉ**
- **Ancien** : `RoadAccessModule.js` — **supprimé**
- **Nouveau** : `contexts/parcels` (`RecalculateRoadAccess*`, `GetBuildingRoadAccess`, `PlaceBuilding` / `RemoveBuilding`)
- **Tests** : `tests/contexts/parcels/roadAccess.behavior.test.js`, `placeRemove.behavior.test.js`
- **ACL** : `hasRoadAccessFromCount`, `parcels.getRoadAccess(id)`
- **Notes** : plus de module Three.js ; filet tick = `RecalculateAllRoadAccess`

#### EmploymentModule ✅ **IMPLÉMENTÉ**
- **Fichier** : `src/js/game/modules/EmploymentModule.js`
- **Tests** : `tests/EmploymentModule.test.js` (30 tests)
- **Fonctionnalités testées** :
  - ✅ `updateFromEmployees()` - Mise à jour depuis IndexedDB
  - ✅ `getWorkerDeficit()` - Calcul du déficit
  - ✅ `needsWorkers()` - Vérification si besoin
  - ✅ `isFullyStaffed()` - Vérification si complètement pourvu
  - ✅ `getEmploymentRate()` - Calcul du taux d'emploi (0-100%)
  - ✅ `hasWorkers()` - Vérification si travailleurs présents
  - ✅ `getWorkerCount()` / `getWorkerNeed()` - Getters
  - ✅ `toHTML()` - Génération HTML
- **Statut** : ✅ 30 tests passent
- **Notes** : Fonctions utilitaires simples. Tests complets de tous les calculs.

### Stores (nécessitent mocking IndexedDB)

#### HousesStore ✅ **IMPLÉMENTÉ**
- **Fichier** : `src/js/stores/HousesStore.js`
- **Tests** : `tests/HousesStore.test.js` (46 tests)
- **Fonctionnalités testées** :
  - ✅ **CRUD Operations** : `addHouse()`, `getHouse()`, `getHouseItem()`, `updateHouseFields()`, `deleteOneHouse()`, `clearHouses()`
  - ✅ **Calculs agrégés** : `getGlobalPopulation()`, `getFamishedPopulation()`, `getGlobalBuildingPrices()`
  - ✅ **Groupements** : `getBuildingPricesByType()`, `getTotalBuildingExpensesByType()`, `getEachBuildingsExpenses()`
  - ✅ **Méthodes spécialisées** : `updateHouseName()`, `incrementHouseField()`, `processPopulationFoodLogic()`
  - ✅ **Tri** : `getAllHousesSortedByNameAndPrice()`
- **Statut** : ✅ 46 tests passent
- **Notes** : Base de données isolée par test avec `fake-indexeddb`. Tests complets couvrant tous les cas d'usage et cas limites. Export de la classe `HouseStore` ajouté pour permettre l'injection de base de test.

#### FoodTraceabilityService
- **Fichier** : `src/js/stores/FoodTraceabilityService.js`
- **Fonctionnalités à tester** :
  - Enregistrement des transactions alimentaires
  - Récupération de l'historique
  - Filtrage par tour/mois/année
- **Difficulté** : ⚠️ Moyenne
  - Nécessite `fake-indexeddb`
  - Tests de traçabilité

### Utilitaires (fonctions pures)

#### Utils supplémentaires
- **Fichier** : `src/js/utils/utils.js`
- **Fonctionnalités à tester** (non encore testées) :
  - `getBuildingsNamesInZone()` - Récupération des bâtiments dans une zone
  - `updateBuildingNeighbors()` - Mise à jour des voisins
  - `getAssetsByCategory()` - Filtrage par catégorie
  - `isAreaAvailableForBuilding()` - Déjà testé ✅
- **Difficulté** : ✅ Facile à Moyenne
  - Certaines fonctions nécessitent des structures de données complexes

## 🔧 Difficultés techniques rencontrées

### 1. Mocking IndexedDB avec Dexie
**Problème** : `db.js` essaie de supprimer la base au chargement, ce qui ne fonctionne pas avec `fake-indexeddb`.

**Solution appliquée** :
- Création d'une base de test isolée dans chaque test
- Injection de la base de test dans le service à tester
- Éviter d'importer directement `db.js` dans les tests

**À améliorer** :
- Créer un mock de `db.js` qui fonctionne avec ESM
- Ou créer un factory pattern pour les bases de données de test

### 2. Synchronisation config ↔ BudgetManager
**Problème** : `getCurrentBudget()` synchronise automatiquement le budget avec `config.budget.initialFunds`, ce qui interfère avec les tests.

**Solution appliquée** :
- Lire directement depuis la base de données dans les tests
- Éviter d'utiliser `getCurrentBudget()` après les modifications

**À améliorer** :
- Ajouter un flag pour désactiver la synchronisation en mode test
- Ou séparer la logique de synchronisation dans une méthode dédiée

### 3. Mocking en ESM
**Problème** : `jest.fn()` et `jest.spyOn()` ne sont pas disponibles globalement en ESM.

**Solution appliquée** :
- Utiliser des fonctions mock simples
- Stocker les appels dans un tableau pour vérification

**À améliorer** :
- Importer depuis `@jest/globals` si nécessaire
- Ou configurer Jest pour exposer les globals

### 4. import.meta.env dans Node.js
**Problème** : `import.meta.env` est spécifique à Vite et n'existe pas dans Node.js/Jest.

**Solution appliquée** :
- Vérification défensive : `typeof import.meta !== 'undefined'`
- Fallback vers `undefined` si non disponible

**Statut** : ✅ Résolu

### 5. localStorage en Node.js
**Problème** : `localStorage` n'existe pas dans Node.js.

**Solution appliquée** :
- Mock de `localStorage` dans `tests/setup.js`
- Implémentation complète avec toutes les méthodes

**Statut** : ✅ Résolu

## 📊 Priorités d'implémentation

### ✅ Terminé (177 tests)
- **FoodModule** - 32 tests ✅
- **Parcels road access** - behavior tests (`contexts/parcels`) ✅
- **EmploymentModule** - 30 tests ✅
- **HousesStore** - 46 tests ✅
- **Utils supplémentaires** - 20 tests ✅
- **FoodDistributionService** - 18 tests ✅ (partiel)

### Priorité Haute (fonctions critiques)
1. **EmploymentDistributionService** - Distribution des travailleurs
2. **FoodDistributionService** - Tests d'intégration complets (collectFoodFromFarms, distributeFoodToHouses)

### Priorité Moyenne (utilitaires)
3. **Utils supplémentaires** - Fonctions utilitaires

### Priorité Basse (complexe, moins critique)
5. **EmploymentPriorityService** - Système de priorités
6. **WindmillService** - Collecte des moulins
7. **RoadConnectivityService** - Connectivité routière (graphe)
8. **RandomEventsService** - Événements aléatoires
9. **FoodTraceabilityService** - Traçabilité (bonus)

## 🎯 Recommandations

1. ✅ **Modules** - FoodModule, EmploymentModule ; road access → BC Parcels
2. ✅ **Stores terminés** - HousesStore pour les opérations CRUD de base (46 tests)
3. **Services simples** - EmploymentDistributionService avec mocking minimal
4. **Services complexes** - FoodDistributionService avec structures complètes
5. **Tests d'intégration** - Tester les interactions entre services (optionnel)

## 📝 Notes

- Tous les tests utilisent `fake-indexeddb` pour IndexedDB (fonctionne en mémoire)
- Les tests doivent être isolés (base de données fraîche à chaque test)
- Préférer tester directement depuis la base plutôt que via les méthodes qui ont de la logique métier supplémentaire

## ✅ Récapitulatif des tests créés

### Tests sans mocking (162 tests)
| Module | Fichier de test | Tests | Statut |
|--------|----------------|-------|--------|
| TimeManager | `TimeManager.test.js` | 33 | ✅ |
| EmployeeHelper | `EmployeeHelper.test.js` | 39 | ✅ |
| ModuleHelper | `ModuleHelper.test.js` | 31 | ✅ |
| utils | `utils.test.js` | 30 | ✅ |
| config | `config.test.js` | 29 | ✅ |

### Tests avec mocking (180 tests)
| Module | Fichier de test | Tests | Statut |
|--------|----------------|-------|--------|
| FoodModule | `FoodModule.test.js` | 32 | ✅ |
| Parcels road access | `tests/contexts/parcels/*.behavior.test.js` | — | ✅ |
| EmploymentModule | `EmploymentModule.test.js` | 30 | ✅ |
| HousesStore | `HousesStore.test.js` | 46 | ✅ |
| Utils supplémentaires | `utils.test.js` (extensions) | 20 | ✅ |
| FoodDistributionService | `FoodDistributionService.test.js` | 18 | ✅ |
| EmployeeHelper.localStorage | `EmployeeHelper.localStorage.test.js` | 8 | ✅ |
| BudgetManager | `BudgetManager.test.js` | 16 | ⚠️ (13 passent, 3 échouent) |

**Total : 362 tests (359 passent, 3 échouent)**

### Détails des tests HousesStore

**CRUD Operations (12 tests)**
- `addHouse()` - Ajout avec gestion des doublons et pendingAdditions
- `getHouse()` - Récupération simple
- `getHouseItem()` - Récupération de champs avec valeurs par défaut
- `updateHouseFields()` - Mise à jour et création automatique
- `deleteOneHouse()` - Suppression
- `clearHouses()` - Suppression de tous les bâtiments

**Calculs agrégés (6 tests)**
- `getGlobalPopulation()` - Somme de toutes les populations
- `getFamishedPopulation()` - Calcul de la population affamée (maisons uniquement)
- `getGlobalBuildingPrices()` - Somme de tous les prix

**Groupements et tri (4 tests)**
- `getBuildingPricesByType()` - Prix groupés par type
- `getTotalBuildingExpensesByType()` - Dépenses par type
- `getEachBuildingsExpenses()` - Dépenses détaillées avec nombre
- `getAllHousesSortedByNameAndPrice()` - Tri

**Méthodes spécialisées (24 tests)**
- `updateHouseName()` - Renommage avec préservation des données
- `incrementHouseField()` - Incrémentation avec conditions
- `processPopulationFoodLogic()` - Logique de population basée sur routes

**Bonnes pratiques appliquées :**
- Base de données isolée par test (`beforeEach`/`afterEach`)
- Injection de base de test via `housesStore.db = testDb`
- Export de la classe `HouseStore` pour permettre l'instanciation en test
- Tests couvrant cas d'usage réels et cas limites

