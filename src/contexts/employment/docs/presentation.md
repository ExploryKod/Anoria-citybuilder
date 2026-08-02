# Employment — présentation (UI / scène 3D)

Documentation **alignée sur le code** (`game.js`, `scene.js`, ACL).  
Décrit comment les métriques emploi et les icônes `no-work` atteignent l’écran.

---

## Responsabilités par couche

| Couche | Rôle | Ne fait pas |
|---|---|---|
| **Employment BC** | Écrit `employees.worker` (`DistributeCityWorkers`) ; read model `GetCityEmploymentSummary` | Sprites 3D, barre d’état directe |
| **Supply BC** | Chaîne alimentaire ; `OperationalGatePolicy` pour l’activité réelle ; flags `isBuying` / `isCollecting` | Icônes emploi `no-work` |
| **`scene.update`** | Meshes, routes, sprites **Supply** (saison ferme, `isBuying`, `isCollecting`, `no-food`…) | Poser/retirer `no-work` |
| **`refreshEmploymentPresentation`** | Barre d’état emploi + **seule** source des sprites `no-work` | Logique Supply |

Règle : **`scene.update` ne lit plus `employees.worker` pour afficher des icônes emploi.**

---

## Read model unique — `GetCityEmploymentSummary`

Implémentation : `computeCityEmploymentSummary.js` → query `GetCityEmploymentSummary` → ACL `getCityEmploymentSummary()`.

```javascript
{
  workerPool,           // citoyens ouvriers bruts (maisons routées)
  elitePool,            // élites palais (affichage)
  totalPopulation,      // workerPool + elitePool
  civilServantCount,    // floor(totalPopulation / 12)
  laborPool,            // workerPool − civilServantCount
  activeCitizenCount,   // citoyens actifs (employés, hors chômeurs/élites/fonct.)
  activePopulationCount,// activeCitizenCount + elitePool + civilServantCount
  totalAssigned,        // Σ employees.worker (postes routés)
  totalNeed,            // Σ workerNeed (postes routés)
  unemployed,           // max(0, laborPool − totalAssigned)
  unemploymentPercentage,
  lack,                 // Σ max(0, workerNeed − worker) — déficit postes
  understaffedBuildingIds,  // instanceId où worker === 0 && need > 0 && route
  bySector,
}
```

Consommateurs :

| Surface | Fichier |
|---|---|
| Barre d’état + icônes `no-work` | `scene.refreshEmploymentPresentation` |
| Panneau Travail | `work-section.js` |
| Checks commerce | `commerce-section.js` |

---

## Icônes `no-work` (rouge)

**Condition** (identique allocation et affichage) :

```
roadCount > 0  AND  workerNeed > 0  AND  worker === 0   (autres postes)
workerNeed > 0  AND  worker === 0                        (fermes — route optionnelle)
```

- Clé : `instanceId` (UUID), pas le label `type-x-y`.
- Bâtiments concernés : marché, ferme, moulin, usine (`refreshEmploymentPresentation` ~l.1703–1707).
- Positions sprite : ferme/usine `{ x: -0.8, y: 0.5, z: -0.2 }` ; marché/moulin `{ x: -0.5, y: 0.5, z: 0 }`.

**Ce que `no-work` n’est pas :**

| Confusion | Réalité code |
|---|---|
| « Manque global > 0 » | `lack` peut être > 0 avec sous-effectif partiel (ex. 1/3) **sans** icône — seulement `worker === 0` |
| « Chômage > 0 » | Surplus de main-d’œuvre ; après redistribution gloutonne, incompatible avec un poste routé encore à `worker === 0` |
| Sprite `no-food` jaune (ferme hiver) | Supply/saison — pas emploi |
| `isBuying` / `isCollecting` | Supply — masqués par `GetBuildingSupplyView` si bâtiment non opérationnel |

---

## Chômage vs manque (barre d’état)

Deux métriques **indépendantes** :

| Indicateur | DOM | Formule |
|---|---|---|
| **Chômage** | `.display-unemployed-pop` | `unemployed (unemploymentPercentage %)` |
| **Manque** | `.display-worker-lack` | chiffre rouge seul = `lack` |

Après `DistributeCityWorkers` (allocation gloutonne par priorité secteur) :

- **Chômage > 0** → tous les postes éligibles sont pourvus ; citoyens en surplus.
- **Manque > 0** → pool épuisé ; certains postes sous-staffés ou vides.
- **Les deux > 0 simultanément** → n’arrive pas après une redistribution complète.

---

## Flux simulation — tick mensuel (`game.update`)

```
gameUI.updateTimeDisplay
city.update()
│
├─ scene.update(city, time)          ← 1re passe : meshes, voisins, sprites Supply
│
├─ runSimulationPass(time)
│    ├─ runtime.runSimulation        ← ECS (ordre ci-dessous)
│    ├─ services.simulate            ← RandomEvents, Commerce, EmploymentPriority…
│    └─ scene.update(city, time)     ← 2e passe : sync après écritures ECS
│
└─ refreshEmploymentPresentationForCity()
     └─ scene.refreshEmploymentPresentation  ← barre + no-work
```

### Ordre ECS (`createGameRuntime.js`)

```
1. parcels.roadAccess
2. supply.monthlyFood
3. housing.populationGrowth
4. housing.evolution
5. employment.redistribute      ← reset worker=0 puis allocation
6. supply.factoryProduction
```

`employment.redistribute` appelle `DistributeCityWorkers` puis `synchronizeFactoryWorkerDistribution` (Winery).

Priorités secteur : `getAllSectorPriorities()` (localStorage + défauts `config.employment.defaultPriorities`).

---

## Entry points présentation (`game.js`)

Helpers internes ( aussi exposés sur `window.game` où indiqué ) :

| Helper | Enchaînement | Quand |
|---|---|---|
| `refreshEmploymentPresentationForCity()` | `scene.refreshEmploymentPresentation` | Fin de tout flux qui doit sync barre + no-work |
| `runSimulationPass(time)` | ECS → services → `scene.update` | Après une 1re `scene.update` |
| `runScenePresentationPass(time)` | `scene.update` → refresh emploi | Interaction sans ECS |

| Action joueur | Flux réel |
|---|---|
| **Tick mensuel** | `game.update` (tableau ci-dessus) |
| **Clic info** (`select-object`) | `runScenePresentationPass` |
| **Placement bâtiment** | `scene.update` → `runSimulationPass` → `syncEmploymentAfterBuildingChange` |
| **Bulldoze** | `scene.update` → `syncEmploymentAfterBuildingChange` |
| **Démarrage jeu** | `refreshEmploymentPresentationForCity()` (fire-and-forget) |

`syncEmploymentAfterBuildingChange` (ACL) :

- Type = poste (`worker_need > 0`, hors maison/route) → `redistributeCityEmployment()` puis refresh.
- Sinon → refresh seulement.

---

## Sprites Supply dans `scene.update` (découplés emploi)

| Bâtiment | Sprites | Source données |
|---|---|---|
| Marché | `isBuying`, `no-food` | `supply.getBuildingSupplyView` |
| Moulin | `isCollecting` | idem |
| Ferme | `grow-food`, `harvest`, `sell-food`, `no-food` (hiver), `sold-to-windmill` | saison `TimeManager` + Supply view |
| Usine | — | pas de sprite Supply dédié dans `scene.update` |

`GetBuildingSupplyView` applique `OperationalGatePolicy` sur les flags UI :

```javascript
isBuying: operational && view.isBuying
isCollecting: operational && view.isCollecting
```

→ un marché sans ouvriers n’affiche pas `isBuying` même si le flag persistant est `true`.

Les sprites **saison ferme** restent calendaires (hiver = `no-food` jaune) ; l’icône **no-work** rouge est ajoutée par-dessus par `refreshEmploymentPresentation` si `understaffedBuildingIds` contient la ferme.

---

## Fichiers de référence

| Fichier | Rôle |
|---|---|
| `src/js/game/game.js` | Orchestration tick + helpers présentation |
| `src/js/game/scene.js` | `update`, `refreshEmploymentPresentation` |
| `src/js/acl/employment.js` | ACL read model + `syncEmploymentAfterBuildingChange` |
| `contexts/employment/domain/computeCityEmploymentSummary.js` | Agrégats + `understaffedBuildingIds` |
| `contexts/employment/application/commands/DistributeCityWorkers.js` | Allocation |
| `contexts/supply/application/queries/GetBuildingSupplyView.js` | Gate opérationnel UI Supply |
| `contexts/supply/domain/policies/OperationalGatePolicy.js` | route + `worker > 0` si `workerNeed > 0` |

Règles métier détaillées (pool, redistribution, formules) : [`rules.md`](rules.md).
