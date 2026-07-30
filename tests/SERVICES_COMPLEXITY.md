# Analyse de Complexité - Services à Tester

## 🎯 Comparaison des deux services prioritaires

### 1. FoodDistributionService

**Complexité globale : ⚠️ Moyenne à Élevée**

#### Points de complexité :

1. **Dépendances multiples** ⚠️
   - Dexie `houses` table (IndexedDB) - Accès via ACL Construction / BC repos ✅
   - `TimeManager` - Calculs de temps/saisons
   - `FoodTraceabilityService` - Traçabilité (peut être mocké)
   - `checkRoadAccess` (ModuleHelper) - Déjà testé ✅
   - `config.simulation.foodDistributionDistance` - Configuration

2. **Logique métier complexe** ⚠️⚠️
   - **Saisons** : Fermes ne produisent pas en hiver (janvier-février-mars)
   - **Automne uniquement** : Marchés n'achètent qu'en automne (`isBuying` flag)
   - **Distance Manhattan** : Calcul de distance entre fermes/marchés et marchés/maisons
   - **Vérification route** : Marchés sans route ne peuvent ni recevoir ni distribuer
   - **Vérification employés** : Marchés sans employés ne fonctionnent pas
   - **Détection `noFarmsNearby`** : Marque les marchés trop loin des fermes

3. **Structures de données complexes** ⚠️⚠️
   - **Fermes** : Production par type (wheat, carrot, cabbage)
   - **Marchés** : Stocks multiples (wheat, carrot, cabbage, food total)
   - **Maisons** : Stocks multiples + population
   - **Voisins** : Array d'objets avec `buildingId`, `name`, `isRoad`
   - **Coordonnées** : x, y pour calcul de distance

4. **Flux de données** ⚠️⚠️
   ```
   Ferme (production) → Marché (collecte) → Maison (distribution)
   ```
   - Collecte depuis plusieurs fermes vers un marché
   - Distribution depuis un marché vers plusieurs maisons
   - Gestion des stocks (déduction/ajout)

5. **Tests à créer** (estimation : ~25-30 tests)
   - `calculateDistance()` - Distance Manhattan (simple ✅)
   - `simulate()` - Orchestration globale
   - `processMarket()` - Logique principale (complexe)
   - `findHousesInRange()` - Filtrage par distance
   - `updateHousesMarketDistanceStatus()` - Détection distance
   - Tests de saisons (hiver, automne)
   - Tests de routes (avec/sans accès)
   - Tests d'employés (avec/sans)
   - Tests de distance (trop loin/proche)

---

### 2. EmploymentDistributionService

**Complexité globale : ⚠️ Moyenne**

#### Points de complexité :

1. **Dépendances** ⚠️
   - Dexie `houses` table (IndexedDB) - Accès via ACL Construction / BC repos ✅
   - `TimeManager` - Calculs de temps (moins critique)
   - `getSectorPriority`, `getAllSectorPriorities` (EmployeeHelper) - localStorage
   - `checkRoadAccess` (ModuleHelper) - Déjà testé ✅
   - `config.buildingSectorMap` - Mapping secteur → bâtiment

2. **Logique métier** ⚠️
   - **Système de priorités** : Priorité 1 = plus important (inverse de l'intuition)
   - **Tri par priorité** : Trier les bâtiments par priorité avant distribution
   - **Reset global** : Réinitialiser tous les workers à 0 avant redistribution
   - **Vérification route** : Maisons sans route ne fournissent pas de workers
   - **Calcul déficit** : `worker_need - worker` pour chaque bâtiment

3. **Structures de données** ⚠️
   - **Bâtiments** : `employees.worker`, `employees.worker_need`, `sector`
   - **Maisons** : `pop` (population = workers disponibles)
   - **localStorage** : Priorités par secteur (déjà mocké ✅)
   - **IndexedDB** : Secteur statique par bâtiment

4. **Flux de données** ⚠️
   ```
   Maisons (population) → Bâtiments (selon priorité)
   ```
   - Calcul total workers disponibles
   - Tri bâtiments par priorité
   - Distribution séquentielle jusqu'à épuisement

5. **Tests à créer** (estimation : ~20-25 tests)
   - `simulate()` - Orchestration globale
   - `resetAllWorkers()` - Réinitialisation
   - `calculateAvailableWorkers()` - Somme population
   - `getBuildingsNeedingWorkers()` - Filtrage + tri par priorité
   - `distributeWorkers()` - Distribution séquentielle
   - Tests de priorités (1 = premier, 6 = dernier)
   - Tests de routes (avec/sans accès)
   - Tests de déficit (besoin vs disponible)

---

## 📊 Comparaison directe

| Critère | FoodDistributionService | EmploymentDistributionService |
|---------|------------------------|-------------------------------|
| **Complexité logique** | ⚠️⚠️ Élevée (saisons, distance, stocks) | ⚠️ Moyenne (priorités, distribution) |
| **Dépendances** | ⚠️⚠️ Nombreuses (TimeManager, FoodTraceability) | ⚠️ Moins nombreuses |
| **Structures données** | ⚠️⚠️ Complexes (stocks multiples, voisins) | ⚠️ Simples (workers, population) |
| **Tests estimés** | ~25-30 tests | ~20-25 tests |
| **Difficulté mocking** | ⚠️⚠️ Élevée (saisons, distance, stocks) | ⚠️ Moyenne (localStorage déjà mocké) |

---

## 🎯 Recommandation

### Commencer par : **EmploymentDistributionService**

**Pourquoi ?**
1. ✅ **Moins de dépendances** - localStorage déjà mocké
2. ✅ **Logique plus simple** - Pas de saisons, pas de distance
3. ✅ **Structures plus simples** - Workers vs stocks multiples
4. ✅ **Bon compromis** - Complexe assez pour être utile, simple assez pour être faisable
5. ✅ **Fondation** - Une fois maîtrisé, FoodDistributionService sera plus facile

**Points d'attention pour EmploymentDistributionService :**
- Mock `localStorage` pour les priorités (déjà fait ✅)
- Créer des structures de bâtiments avec `employees` et `sector`
- Tester le tri par priorité (inverse : 1 = premier)
- Tester la distribution séquentielle (premier bâtiment remplit d'abord)

---

## 📝 Plan de test pour EmploymentDistributionService

### Phase 1 : Tests unitaires simples (5-8 tests)
- `calculateDistance()` si présent (sinon skip)
- Helpers simples (`isHouse()`, `isRoad()`)

### Phase 2 : Tests de méthodes individuelles (10-12 tests)
- `resetAllWorkers()` - Réinitialisation
- `calculateAvailableWorkers()` - Calcul total
- `getBuildingsNeedingWorkers()` - Filtrage + tri

### Phase 3 : Tests d'intégration (5-8 tests)
- `simulate()` - Scénarios complets
- Distribution séquentielle
- Gestion des priorités

**Total estimé : 20-28 tests**

---

## ⚠️ Points de vigilance

### Pour EmploymentDistributionService :
1. **localStorage** - Déjà mocké, mais vérifier que les priorités sont bien lues
2. **Tri inverse** - Priorité 1 = premier (tester explicitement)
3. **Reset global** - S'assurer que tous les workers sont bien réinitialisés
4. **Routes** - Maisons sans route ne comptent pas dans les workers disponibles

### Pour FoodDistributionService (plus tard) :
1. **Saisons** - Mock TimeManager pour tester hiver/automne
2. **Distance** - Tester les calculs Manhattan
3. **Stocks multiples** - Gérer wheat/carrot/cabbage/food
4. **FoodTraceabilityService** - Peut être mocké ou ignoré pour les tests simples

