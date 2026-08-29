# Constellation de hameaux — plan d’action

Document de conception et feuille de route pour **plusieurs hameaux jouables** avec **une seule grille 3D à la fois** — le jeu reste le même pour le joueur, seul le lieu visible change.

**Statut :** en cours — prototype voyage + persistance (phases 0–2 largement amorcées)  
**Branche :** `feature/basic-gameplay` (ou dérivée)  
**Références :** [`multiple_hamlet.md`](multiple_hamlet.md), [`game_vision.md`](game_vision.md), [`accessibility.md`](../accessibility.md)

---

## 1. Vision (figée v1)

### Principe

> **Pour le joueur et pour les bounded contexts, c’est toujours « une ville ».**  
> Seuls changent : la **couche Three.js** (swap de scène) et **IndexedDB** (`hamletId` sur les bâtiments pour recréer ce que le joueur a construit ailleurs).

- Gameplay 3D **inchangé** : construction, admin, pause, caméra, économie globale.
- **Pas de carte pays** : voyage via le **carrousel de hameaux** (FAB bas, à côté de la construction). Une **carte stratégique 2D** (`/hamlets`, `/world`) est prévue en complément — pas de remplacement du carrousel in-game en v1.
- **Pas d’API debug** (`switchHamlet('b')`) : le voyage se fait **dans le jeu**.
- Les **BC métier** (construction, housing, supply, emploi, compta…) **ne bougent pas** ou très peu : filtre `hamletId` sur les adapters Dexie + session `activeHamletId`.
- Budget WebGL **identique** : une grille 12–18, un canvas, scène **remplacée** au voyage.

### Non-objectifs v1

| Exclu | Reporté / jamais v1 |
|--------|---------------------|
| Carte pays 2D | Tick abstrait hameaux lointains — **carte stratégique hex prévue** : voir [`map_pages.plan.md`](map_pages.plan.md) (`/world`, `/hamlets`) |
| Graphe routes pays | Migration citoyens inter-hameaux |
| Ledger / budget par hameau | Compta filtrée par hameau |
| Monde 3D continu | Agents 3D inter-map |

*(Ces sujets peuvent revenir en « v2 empire » si besoin — hors scope actuel.)*

### Architecture minimale

```text
Session
  └── activeHamletId  (RAM cache + Dexie `game` row `hamlet-session`)

Dexie
  ├── hamlets       { id, name, natureSeeded? }
  └── houses        { …, hamletId, anchorX/Y, … }  ← vérité bâtiment

RAM (hameau visible)
  └── city.tiles    ← dérivé de houses filtré par activeHamletId

Three.js
  └── scene         ← initialize / clear / hydrate au voyage
```

**Tick :** un seul hameau simulé en détail (celui chargé). Les autres existent **en data** (bâtiments Dexie) jusqu’au prochain voyage.

---

## 2. UX voyage

1. Joueur ouvre le **carrousel** (bouton charrette, barre du bas).
2. Clic sur un hameau **inactif** → **loader** → swap scène.
3. Hameau **actif** en vert ; flèches si la liste dépasse le viewport.
4. Premier visit d’un site vierge : **nature aléatoire** (`seedNature`), puis construction normale.
5. Retour au hameau précédent : **tout est retrouvé** (Dexie → hydratation tuiles → meshes).

Pipeline technique :

```text
travelToHamlet(id)
  → setActiveHamletId(id)
  → clearCityTiles(city)
  → hydrateCityTilesFromRows(houses filtrés)
  → scene.initialize(city, { seedNature? })
  → scene.update(city)
```

Fichiers : `game.js`, `hamletSession.js`, `HamletTravelMenu.js`, `HydrateCityTilesFromBuildings.js`.

---

## 3. HUD population — double lecture (global + hameau visible)

**Seul changement UI métier** demandé en v1 (hors carrousel voyage).

Le rail population (`#hud-pop-rail`) garde les **totaux pays** (partie entière). À côté de chaque métrique globale, afficher la **valeur du hameau actuellement visible** dans **une autre couleur** (ex. vert local vs neutre global).

### Règles d’affichage

| Métrique | Layout |
|----------|--------|
| Pop totale, affamés, morts, pop active, segments (citoyen / élite / fonctionnaire), manque MO | `[icône] [global] [local]` sur **une ligne** |
| **Chômage** | **2 lignes** : ligne 1 = global (effectif + %), ligne 2 = hameau visible (effectif + %) — le % ne tient pas côte à côte |

Exemple pop totale :

```text
[👥]  142  38
       ↑    ↑
    global  hameau visible (couleur locale)
```

Exemple chômage :

```text
[😢]  12  (8%)     ← pays
[😢]   3  (5%)     ← hameau visible (couleur locale)
```

### Implémentation (indicatif)

- Agrégats **pays** : logique actuelle (tous les `houses` ou tick global inchangé).
- Agrégats **hameau** : même requêtes / policies, filtre `hamletId === activeHamletId`.
- Présentation : `GameUI` / sync HUD existant + classes CSS `.pop-detail-value--country` / `.pop-detail-value--hamlet`.
- Accessibilité : `aria-label` explicite (« Population totale pays », « Population hameau visible »).

---

## 4. Plan par phases (v1 simplifié)

### Phase 0 — Reprise fidèle (mono-hameau) — prérequis

| # | Tâche | Statut |
|---|--------|--------|
| 0.1 | `hydrateCityTilesFromRows` | ✅ |
| 0.2 | Hydratation au boot avant `scene.initialize` | ✅ |
| 0.3 | `cleanupOrphanedBuildings` safe avec repos filtrés | ⚠️ |
| 0.4 | Derive-only : tuiles ← `houses` | ✅ |
| 0.5 | Test auto hydratation + test manuel refresh | ⚠️ partiel |

**Done :** refresh = même layout jouable.

---

### Phase 1 — `hamletId` en Dexie — prérequis multi

| # | Tâche | Statut |
|---|--------|--------|
| 1.1 | Dexie v3 : `hamlets` + `hamletId` sur `houses` | ✅ |
| 1.2 | Session `activeHamletId` | ✅ (Dexie `game` / `hamlet-session`, pas de localStorage) |
| 1.3 | Repos : filtre hameau actif à l’écriture / lecture | ✅ |
| 1.4 | Catalogue proto hameaux (seed noms) | ✅ (10 sites de test) |

**Done :** une partie peut stocker N hameaux en Dexie ; gameplay mono-hameau inchangé si un seul site utilisé.

---

### Phase 2 — Swap de scène + voyage in-game

| # | Tâche | Statut |
|---|--------|--------|
| 2.1 | `travelToHamlet` + loader | ✅ |
| 2.2 | Carrousel FAB (a11y clavier) | ✅ |
| 2.3 | Nature vierge par hameau (`natureSeeded`) | ✅ |
| 2.4 | Construire A → voyager B → construire → retour A | ⚠️ à valider |
| 2.5 | Pas de régression caméra / ghost / modales | ⚠️ |

**Done :** boucle joueur A ↔ B sans commande dev, sans carte pays.

---

### Phase 3 — HUD pop global + hameau visible

| # | Tâche | Statut |
|---|--------|--------|
| 3.1 | Agrégats pays (Dexie tous hameaux) | ✅ |
| 3.2 | Agrégats hameau actif (même métriques, filtre scope) | ✅ |
| 3.3 | Markup + CSS double valeur (couleur locale) | ✅ |
| 3.4 | Chômage : 2 rows (pays puis hameau) | ✅ |
| 3.5 | Mise à jour au voyage / tick (`syncPopRailHud`) | ✅ |

**Done :** rail pop lisible ; chaque chiffre global a son pendant hameau visible.

---

### Phase 4 — Finition v1

| # | Tâche | Statut |
|---|--------|--------|
| 4.1 | Smoke : build → voyage → refresh → retrouver tout | ❌ |
| 4.2 | Profiling swap WebGL (fuite meshes / listeners) | ❌ |
| 4.3 | Doc joueur courte (`game_vision.md` ou `multiple_hamlet.md`) | ⚠️ |
| 4.4 | Commit / revue branche | ❌ |

**Done :** v1 jouable et stable pour testers.

---

## 5. Backlog v2 (hors scope actuel)

À ne **pas** planifier tant que v1 n’est pas stable :

- Carte pays, routes graphe, fondation depuis carte
- Tick abstrait hameaux non visités
- Migration citoyens / travailleurs
- Compta et journal par centre de coût `hamletId`
- Table `countries`, `countryRoads`, `migrations`

---

## 6. Fichiers touchés (v1)

| Zone | Fichiers | Nature du changement |
|------|----------|----------------------|
| Persistance | `db.js`, `hamletSession.js` | Faible — schéma + session |
| Adapters Dexie | `Dexie*Repository.js` | Faible — filtre `isActiveHamletRow` |
| Three.js | `game.js`, `scene.js`, `city.js` | **Principal** — swap + hydrate |
| UI voyage | `HamletTravelMenu.js`, `game.html`, CSS | Moyen — carrousel |
| UI pop | `game.html`, `hud.css`, `GameUI.js`, sync HUD | Moyen — double colonne chiffres |
| BC gameplay | `runGameTick`, policies… | **Minimal** — comportement « une ville » |

---

## 7. Critères de succès v1

- [ ] Le jeu se comporte **comme avant** sur un seul hameau.
- [ ] Voyage entre hameaux **via le carrousel** ; loader ; constructions persistées.
- [ ] Refresh navigateur : hameau actif + tous les hameaux Dexie intacts.
- [ ] Rail pop : **global + hameau visible** (chômage sur 2 lignes).
- [ ] Budget GPU identique ; pas de régression a11y voyage / modales.
- [ ] **Pas** de carte pays, **pas** d’API debug.

---

## 8. Prochaine action

1. **Valider Phase 2** — smoke A ↔ B (10 hameaux proto).  
2. **Implémenter Phase 3** — agrégats hameau + rail pop double colonne.  
3. **Clore Phase 0** — test refresh signé.

Owner : _à assigner_  
Estimation Phase 3 (HUD pop) : _1–2 jours_  
Estimation v1 complète (phases 0–4 restantes) : _~1 semaine_
