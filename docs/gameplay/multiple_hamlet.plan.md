# Constellation de hameaux — plan d’action

Document de conception et feuille de route pour passer d’**une seule grille 3D** à un **pays de hameaux** (données à l’échelle du pays, rendu 3D d’un seul hameau à la fois).

**Statut :** conception validée — implémentation non démarrée  
**Branche cible :** `feature/multiple-scenes` (ou dérivée)  
**Références :** [`game_vision.md`](game_vision.md), [`commerce/docs/gameplay.plan.md`](../../src/contexts/commerce/docs/gameplay.plan.md), [`accessibility.md`](../accessibility.md)

---

## 1. Vision & contraintes

### Objectif

Offrir une expérience « empire / César III » (constellation de hameaux, population cumulée élevée) **sans augmenter le budget WebGL** : toujours **une grille 12–18**, toujours **un canvas Three.js**, scène **remplacée** au voyage (pas de scènes parallèles).

### Décisions produit (figées)

| Sujet | Choix |
|-------|--------|
| Nouveaux hameaux | **Oui** — fondation sur site vierge |
| Trésorerie | **Les deux** — ledger pays unique + vue / enveloppe par hameau |
| Migration | **Oui** — citoyens / travailleurs entre hameaux (data, pas agents 3D inter-map) |
| Routes | **Deux niveaux** — voirie locale (tuiles) + **arêtes pays** (graphe 2D) |
| Nombre de hameaux | **Dynamique** — pas de plafond métier fixe |
| UI gameplay 3D | **Inchangée** (construction, admin, pause, caméra) |
| Navigation pays | **Cartes 2D existantes** (carte ville, carte commerce) + loader voyage |

### Non-objectifs (v1)

- Monde 3D continu scrollable
- Plusieurs scènes Three.js simultanées
- LOD / billboards des hameaux lointains dans la scène active
- Agents 3D migrant d’un hameau à l’autre sur la carte

### Principe technique

```text
Pays (Dexie + RAM)     →  toujours
Hameau actif (tiles)   →  1 seul en RAM
Scène 3D               →  hydrate / unload / initialize
Tick détaillé          →  hameau actif
Tick abstrait          →  autres hameaux (mensuel)
```

---

## 2. Architecture cible

### Couches

```text
Country
  ├── id, name, activeHamletId
  ├── treasury (solde global — source de vérité)
  └── graph: hamlets + countryRoadEdges

Hamlet
  ├── id, name, gridSize, mapPosition {x,y}
  ├── neighborHamletIds[] (via arêtes)
  └── aggregates (pop, budget slice, lastAbstractTick)

Building (Dexie houses + hamletId)
  ├── instanceId, hamletId, anchorX/Y (locaux 0..size-1)
  └── champs gameplay existants (stocks, pop, employees…)

MigrationQueue (Dexie ou table dédiée)
  └── fromHamletId, toHamletId, citizens, workers, etaTurn
```

### Invariants

1. **`city.tiles`** = vérité placement **du hameau actif** en session.
2. **Dexie `houses`** = vérité état bâtiment ; filtrée par **`hamletId`**.
3. Coordonnées **locales par hameau** (pas de refonte des BC `[anchorX+anchorY]`).
4. **Un seul `activeHamletId`** à la fois ; swap = persist → unload → hydrate → init scène.
5. **Journal comptable unique** ; les écritures portent un **`hamletId` optionnel** (centre de coût).

### Fichiers clés (état actuel)

| Domaine | Fichiers |
|---------|----------|
| Grille | `src/presentation/three/city.js` |
| Scène | `src/presentation/three/scene.js`, `game.js` |
| Persistance | `src/core/persistence/dexie/db.js`, `BuildingRecord.js` |
| Session | `GameSessionBootstrap.js`, `runGameTick.js` |
| Carte 2D | `carte-ville/CarteVillePanel.js`, `admin/commerce/renderTradeMap.js` |
| Décor (à retirer / adapter) | `DecorativeVillageManager.js` |

### Lacune bloquante actuelle

Aujourd’hui **`city.tiles` n’est pas rechargé depuis Dexie au boot** ; `cleanupOrphanedBuildings` peut supprimer des lignes incohérentes. **Phase 0 obligatoire** avant multi-hameaux.

---

## 3. Stratégie de simulation

| Hameau | Tick |
|--------|------|
| **Actif (chargé)** | Tick complet actuel (tuiles, supply, emploi, 3D) |
| **Autres** | Tick **abstrait mensuel** : pop agrégée, stocks barn/marché simplifiés, budget, migrations en transit, flux sur arêtes |

Au **chargement** d’un hameau : hydrater `city.tiles` depuis Dexie ; optionnellement **réconcilier** agrégats abstraits → bâtiments.

---

## 4. UX voyage & fondation

### Voyage entre hameaux

1. Joueur ouvre **carte pays** (évolution de carte ville ou couche dédiée).
2. Clic hameau → confirmation → **écran charrette / loader**.
3. Pipeline : `saveActiveHamlet()` → `unloadScene()` → `loadHamlet(id)` → `scene.initialize()`.
4. HUD identique ; seul le contenu de la grille change.

### Fondation (site vierge)

1. Depuis carte pays : « Fonder un hameau » sur emplacement libre.
2. Coût deniers + éventuelle **arête route** vers un hameau existant.
3. Création `hamlet` + swap vers grille vide (`createCity(size)`).
4. Construction normale (comme aujourd’hui).

### Routes pays

- **Graphe** : `{ fromHamletId, toHamletId, builtAt, maintenance? }`.
- Affichage : **carte 2D** (commerce / pays), pas de mesh inter-scènes.
- Débloque : voyage, migration, commerce interne (phase ultérieure).

---

## 5. Plan d’action par phases

Chaque phase a des **livrables**, des **critères de done** et des **dépendances**. Ne pas sauter Phase 0.

---

### Phase 0 — Save/load mono-hameau (prérequis)

**But :** une partie = reprise fidèle après refresh.

| # | Tâche | Notes |
|---|--------|--------|
| 0.1 | Service `hydrateCityTilesFromDexie(hamletId?)` | `houses` → `stampBuildingFootprint` sur `city.tiles` |
| 0.2 | Appeler hydratation au boot **avant** `scene.initialize` | `GameSessionBootstrap` |
| 0.3 | Adoucir / ordonner `cleanupOrphanedBuildings` | Ne pas nuker après hydratation |
| 0.4 | Persister tuiles ou garantir dérivation 100 % buildings | Choisir : derive-only v1 |
| 0.5 | Test manuel + test auto : pose → refresh → même layout | |

**Done quand :** refresh navigateur = même ville jouable.

---

### Phase 1 — Modèle `hamletId` & session

**But :** données prêtes pour N hameaux ; gameplay encore mono-hameau.

| # | Tâche | Notes |
|---|--------|--------|
| 1.1 | Migration Dexie : table `hamlets`, champ `hamletId` sur `houses` | Default `"main"` pour saves existantes |
| 1.2 | Table `countries` (ou row singleton) : `activeHamletId` | |
| 1.3 | `HamletContext` / `session.activeHamletId` | Remplacer accès global implicite |
| 1.4 | Repositories : `listByHamlet(hamletId)`, `place…(hamletId)` | Adapters construction / housing |
| 1.5 | Seed : 1 hameau « Eraanurbs » à la création de partie | |

**Done quand :** toutes les écritures Dexie portent `hamletId` ; comportement identique à avant.

---

### Phase 2 — Swap de scène (2 hameaux de test)

**But :** prouver unload/load sans fuite mémoire ni état fantôme.

| # | Tâche | Notes |
|---|--------|--------|
| 2.1 | `saveActiveHamlet()` — flush tiles → Dexie si needed | |
| 2.2 | `unloadHamletScene()` — dispose meshes, citizens, zones, décor | Inverse de `scene.initialize` |
| 2.3 | `loadHamlet(hamletId)` — `createCity` + hydrate + initialize | |
| 2.4 | API dev : bouton / console `switchHamlet('b')` | Debug only |
| 2.5 | Vérifier : caméra, ghost placement, popupManager, `isGameWorldInputLocked` | a11y inchangée |
| 2.6 | Seed dev : hameau B vide 12×12 + quelques bâtiments Dexie | |

**Done quand :** A ↔ B en < 3 s, pas de doublons meshes, pop/compta cohérents.

---

### Phase 3 — Carte pays & voyage joueur

**But :** navigation sans commande dev ; loader charrette.

| # | Tâche | Notes |
|---|--------|--------|
| 3.1 | Mode « pays » sur `CarteVillePanel` ou panneau dédié | Nœuds = hameaux |
| 3.2 | Clic hameau → `TravelToHamlet` use-case | Pause + loader |
| 3.3 | Écran transition (charrette / texte / barre) | Réutiliser `game-loader` |
| 3.4 | Indicateurs : pop, famine, trésorerie slice par nœud | Données agrégées |
| 3.5 | Raccourci HUD « Carte du pays » (si besoin) | Optionnel |

**Done quand :** joueur voyage A → B uniquement via UI.

---

### Phase 4 — Fondation site vierge

**But :** créer un hameau dynamiquement.

| # | Tâche | Notes |
|---|--------|--------|
| 4.1 | UI carte : « Fonder ici » (emplacements libres) | |
| 4.2 | Coût + validation (trésorerie pays, max distance?) | |
| 4.3 | Création `hamlet` + arête optionnelle vers voisin | |
| 4.4 | Swap vers grille vierge ; nom du hameau | |
| 4.5 | Retirer / désactiver `DecorativeVillageManager` fake hamlets | Éviter confusion visuelle |

**Done quand :** 3ᵉ hameau fondé en partie, jouable, persisté.

---

### Phase 5 — Graphe routes pays

**But :** arêtes = voyage + prérequis migration/commerce interne.

| # | Tâche | Notes |
|---|--------|--------|
| 5.1 | Table `countryRoads` | `{ id, from, to, builtAt }` |
| 5.2 | UI : construire route entre deux hameaux (carte) | Coût one-shot |
| 5.3 | Rendu arêtes sur carte pays (+ trade-map plus tard) | 2D only |
| 5.4 | Règle : migration / voyage requiert chemin dans le graphe | BFS simple |

**Done quand :** hameau isolé non joignable ; route débloque voyage.

---

### Phase 6 — Compta pays + budget hameau

**But :** une caisse, deux lectures.

| # | Tâche | Notes |
|---|--------|--------|
| 6.1 | `hamletId` sur écritures journal (nullable = pays) | |
| 6.2 | Agrégats par hameau : recettes, charges, solde slice | |
| 6.3 | UI admin / bilan : filtre « Tout le pays / Hameau X » | Forme UI inchangée |
| 6.4 | Transferts inter-hameaux = écritures explicites | Pas de double caisse |
| 6.5 | Maintenance routes pays (si gameplay) | Optionnel v1 |

**Done quand :** bilan consolidé = somme hameaux + écritures pays.

---

### Phase 7 — Tick abstrait (hameaux non actifs)

**But :** le pays vit quand le joueur n’est pas sur place.

| # | Tâche | Notes |
|---|--------|--------|
| 7.1 | `AbstractHamletTick` policy (mensuel) | Pop, famine, stocks simplifiés |
| 7.2 | Brancher dans `runGameTick` après tick actif | |
| 7.3 | Snapshots agrégés par hameau (`hamlet_aggregates`) | Perf IDB |
| 7.4 | Notifications / news si crise hameau lointain | Réutiliser intelligence |
| 7.5 | Tests : 5 hameaux, 1 actif, pop totale stable | |

**Done quand :** hameau non visité depuis 12 mois évolue (pop / stocks).

---

### Phase 8 — Migration citoyens / travailleurs

**But :** flux entre hameaux connectés.

| # | Tâche | Notes |
|---|--------|--------|
| 8.1 | Table / queue `migrations` | from, to, payload, eta |
| 8.2 | UI admin ou carte : ordonner migration | |
| 8.3 | Départ : −pop maisons hameau A | |
| 8.4 | Transit : N tours (charrette) | |
| 8.5 | Arrivée : tick abstrait ou load place dans logement | |
| 8.6 | Events news « caravane de colons » | Optionnel |

**Done quand :** migration A→B visible en data + à l’arrivée en 3D.

---

### Phase 9 — Robustesse & écologie

| # | Tâche | Notes |
|---|--------|--------|
| 9.1 | Profiling swap (mémoire WebGL, listeners) | |
| 9.2 | Migration Dexie v2→v3 documentée | |
| 9.3 | Tests E2E : fondation → build → voyage → refresh | |
| 9.4 | Doc joueur (`game_vision.md`) | Section pays / hameaux |
| 9.5 | Cap soft perf : alerte si > N hameaux abstraits lents | |

---

## 6. Ordre recommandé (résumé)

```text
Phase 0  Save/load mono-hameau     ████ BLOCKER
Phase 1  hamletId + Dexie
Phase 2  Swap scène (proto 2 hamlets)
Phase 3  Carte pays + voyage
Phase 4  Fondation site vierge
Phase 5  Routes pays (graphe)
Phase 6  Ledger dual-view
Phase 7  Tick abstrait
Phase 8  Migration
Phase 9  Polish
```

**MVP jouable « constellation » :** Phases **0 → 4** (fonder, voyager, construire, sauvegarder).  
**MVP « empire vivant » :** jusqu’à **Phase 7–8**.

---

## 7. Risques & mitigations

| Risque | Mitigation |
|--------|------------|
| Orphelins Dexie / tiles | Phase 0 ; tests refresh |
| Fuite mémoire au swap | `unloadHamletScene` explicite ; profiling Phase 9 |
| BCs supposent une ville globale | `hamletId` sur repos ; pas de coords globales v1 |
| Compta double comptage | Ledger unique + tags ; tests consolidés |
| Hameaux lointains « morts » | Tick abstrait Phase 7 |
| UX carte surchargée | Zoom / clustering sur carte pays |

---

## 8. Critères de succès globaux

- [ ] Budget GPU **identique** à une partie mono-hameau (même taille grille).
- [ ] Population pays **> 1 hameau** cumulée en data (objectif long terme 10 000+).
- [ ] Voyage **< 5 s** sur machine cible.
- [ ] Aucune régression a11y (modales, Tab, gel caméra sous overlay).
- [ ] Save pays complet : tous hameaux + graphe + migrations + journal.

---

## 9. Prochaine action immédiate

**Démarrer Phase 0.1** : spécifier et implémenter `hydrateCityTilesFromDexie` + test refresh.

Owner : _à assigner_  
Estimation Phase 0 : _1–2 jours_  
Estimation MVP Phases 0–4 : _2–4 semaines_ (ordre de grandeur, selon couverture tests).
