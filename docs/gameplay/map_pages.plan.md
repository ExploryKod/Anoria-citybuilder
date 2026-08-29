# Cartes stratégiques — plan d’implémentation (hex Kenney + Phaser)

Document de conception et feuille de route pour les pages **`/world`** (monde extérieur) et **`/hamlets`** (royaume interne), rendues en **grille hexagonale** avec le pack **Kenney Hexagon** et **Phaser 4**, tout en conservant l’architecture Anoria (BC + `mapApi`, pas de Dexie dans les scènes).

**Statut :** S1–S2 livrés (view models + pages statiques SVG/DOM) — S2.5+ à faire (hex + Phaser)  
**Branche :** `feature/hamlets-rule` (ou dérivée cartes)  
**Références :** [`hex_plan_kenney_hexagon.md`](../../../hex_plan_kenney_hexagon.md), [`map.md`](../../../map.md), [`phaser_three.md`](../../../phaser_three.md), [`multiple_hamlet.plan.md`](multiple_hamlet.plan.md), [`commerce/docs/gameplay.plan.md`](../../src/contexts/commerce/docs/gameplay.plan.md)

---

## 1. Vision (figée v1)

### Principe

> **Les cartes sont une couche de stratégie 2D (Phaser), distincte du jeu 3D (`/game`).**  
> La logique métier (déblocage hameaux, routes commerciales, trésorerie) reste dans les **bounded contexts** et **`mapApi`** ; Phaser ne fait qu’afficher et émettre des intentions (clic hex, sélection ville).

| Page | Rôle joueur | Données principales |
|------|-------------|---------------------|
| `/world` | Carte du monde — partenaires commerciaux, ennemis, expansion du royaume | `TradeMapCityCatalog`, `buildWorldMapView`, commerce |
| `/hamlets` | Carte du royaume — 10 proto-hameaux, états actif / débloqué / verrouillé | `HamletMapCatalog`, `hamletAccess`, `hamletSession` |
| `/game` | Inchangé — un hameau en Three.js | runtime ECS existant |

### Flux de navigation

```text
/world  → clic capitale Anoria     → /hamlets
/hamlets → sélection hameau débloqué → voyage (mapApi) → /game
/world  → clic ville commerçante   → panneau HTML commerce (routes, quotas)
```

### Style visuel cible

Approche **hybride** (cf. `hex_plan_kenney_hexagon.md`) :

```text
Couche 0 : fond parchemin / mer (optionnel, PNG ou couleur)
Couche 1 : tuiles terrain Kenney (hex)
Couche 2 : routes commerciales, frontière royaume
Couche 3 : villes / hameaux / ressources (sprites bâtiments Kenney)
Couche 4 : surbrillance hex (hover, sélection) — visible au survol
Couche UI : panneaux HTML à côté du canvas (pas dans Phaser)
```

La grille hex peut rester **discrète** au zoom normal et plus lisible au survol / sélection.

### Non-objectifs v1

| Exclu v1 | Reporté |
|----------|---------|
| Simulation économique sur la carte | Tick ressources par hex |
| Pathfinding naval / caravanes animées | v2 |
| Éditeur de carte in-game | Mode dev « clic → q,r » seulement |
| Remplacement de la grille 3D du jeu | `/game` reste Three.js |
| `pnpm create phaser` (projet séparé) | Phaser = dépendance du monorepo Vite |

---

## 2. Règles d’architecture (non négociables)

```text
contexts/geography/          ← catalogues, définitions monde, queries (view models)
contexts/commerce/           ← partenaires, routes (inchangé côté règles)
core/persistence/dexie/    ← IndexedDB (hamlets, commerce, budget…)
composition/
  bootMapContexts.js         ← bootstrap léger (pas de createGameRuntime)
  mapSessionApi.js           ← API présentation : queries + commandes
presentation/phaser/         ← Phaser UNIQUEMENT (pas d’import Dexie)
presentation/dom/maps/       ← panneaux HTML, contrôleurs DOM
presentation/three/          ← /game seulement
```

| Règle | Détail |
|-------|--------|
| Pas de Dexie dans les scènes Phaser | `scene` reçoit `mapApi` ; après commande → `refresh(view)` |
| Pas de tick jeu sur les pages carte | Pas de `bootGameContexts()` sur `/world` ni `/hamlets` |
| Coordonnées logiques = **axial `{ q, r }`** | Les pixels sont dérivés à l’affichage (`hexSize`, orientation) |
| Pas d’objets Phaser dans les sauvegardes | Dexie stocke hex, terrain, états — pas de sprites |
| Bundle `/game` sans Phaser | `manualChunks: { phaser: ['phaser'] }` dans `vite.config.js` |

---

## 3. Assets Kenney Hexagon Pack

### Emplacement

```text
public/resources/kenney_hexagon-pack/
  License.txt                    ← CC0 (usage commercial OK)
  Spritesheets/
    hexagonTerrain_sheet.xml
    hexagonBuildings_sheet.xml
    hexagonObjects_sheet.xml
    hexagonAll_sheet.xml
  Vector/
    hexagonVector_tiles.svg
    hexagonVector_objects.svg
```

### Conventions techniques

| Paramètre | Valeur retenue |
|-----------|----------------|
| Orientation | **Pointy-top** (cadre atlas 120×140 px) |
| `hexSize` | Rayon centre → coin ; calibrer sur la hauteur 140 px (à valider au sandbox) |
| Chargement Phaser | `this.load.atlas(key, png, xml)` par feuille utilisée |
| Manifest interne | `HexAssetCatalog.js` — clés gameplay → noms de frames Kenney |

### Palette minimale v1 (~15–30 sprites)

| Concept gameplay | Frames Kenney (exemples) |
|------------------|--------------------------|
| Mer / océan | `water_*` |
| Côte | `sand_*` |
| Prairie | `grass_*` |
| Forêt | `forest_*` ou overlay |
| Colline / mine | `dirt_*`, `medieval_mine` |
| Hameau | `medieval_cabin`, `medieval_house` |
| Capitale | `medieval_largeCastle` |
| Port | `mill_crane` ou bâtiment portuaire |
| Sélection | overlay hex (Graphics ou sprite dédié) |

### Prérequis assets

Les PNG sont versionnés dans `Spritesheets/` (`hexagonTerrain_sheet.png`, etc.). Les XML référencent le bon `imagePath` (plus `sprites.png` générique). Vérification :

```bash
pnpm test -- tests/contexts/geography/kenneyHexAtlas.test.js
node scripts/verifyKenneyHexAtlases.js
```

Chargement Phaser : `loadKenneyHexAtlases(this.load)` — voir `public/resources/kenney_hexagon-pack/README.md`.

### Cache PWA (phase intégration)

Ajouter dans `vite.config.js` → `workbox.runtimeCaching` un handler `CacheFirst` pour  
`/resources/kenney_hexagon-pack/**` (après validation taille totale).

---

## 4. Modèle de coordonnées

### Axial (q, r) — source de vérité

```js
// shared/geography/hexCoordinates.js (à créer)

/** @typedef {{ q: number, r: number }} HexPosition */

// Pointy-top, hexSize = rayon centre → sommet
function axialToPixel(hex, hexSize) {
  return {
    x: hexSize * Math.sqrt(3) * (hex.q + hex.r / 2),
    y: hexSize * 1.5 * hex.r,
  };
}

function pixelToAxial(x, y, hexSize) { /* … */ }
function hexKey(q, r) { return `${q},${r}`; }
function hexNeighbors(q, r) { /* … */ }
```

### Migration depuis les coordonnées % actuelles

**État actuel (S1–S2) :** `HamletMapCatalog` et `TradeMapCityCatalog` utilisent `x/y` en **0–100 %** (carte SVG statique).

**Cible :** chaque site possède `hex: { q, r }` dans le catalogue ; les `%` sont retirés une fois Phaser en place.

| Étape | Action |
|-------|--------|
| 1 | Placer les sites sur une grille hex de référence (éditeur dev ou tableau fixe) |
| 2 | Ajouter `hex` aux catalogues ; conserver `x/y` en alias temporaire si besoin |
| 3 | `buildHamletsMapView` / `buildWorldMapView` exposent `map.hex` |
| 4 | Scènes Phaser lisent `hex` uniquement |
| 5 | Supprimer `mapCoordinates` % pour les cartes (garder si utile ailleurs) |

**Ne pas changer l’orientation** après des sauvegardes joueur basées sur des hex.

---

## 5. Modèle de données

### Séparation monde auteur / état joueur

```text
WorldDefinition (statique, versionné)     → tuiles terrain, taille grille
MapEntityCatalog (statique)               → hameaux, villes, catégories
SaveGame / Dexie (dynamique)              → déblocages, routes, brouillard (plus tard)
```

### WorldDefinition (fichiers JS auteur v1)

```js
/** @typedef {'deep-water'|'water'|'coast'|'grassland'|'forest'|'hill'|'mountain'|'desert'} Terrain */

/** @typedef {{ q: number, r: number, terrain: Terrain, resource?: string, discovered?: boolean }} HexTile */

// contexts/geography/domain/world/hamletWorldDefinition.js  — grille ~12×12
// contexts/geography/domain/world/worldMapDefinition.js     — grille régionale plus large
```

### Entités sur la carte

```js
// Hameau (catalogue)
{ id: 'eraanurbs', name: 'Val d'Era', hex: { q: 0, r: 0 } }

// Ville commerce (catalogue — migre TradeMapCityCatalog)
{ id: 'olivea', name: 'Olivea', hex: { q: -4, r: 2 }, partnerId: 'olivea', category: '…' }
```

### Persistance Dexie existante (réutilisée)

| Table / module | Usage carte |
|----------------|-------------|
| `hamlets` + `hamletAccess` | déblocage, voyage |
| `game` row `hamlet-session` | hameau actif |
| commerce (localStorage / repo) | partenaires, routes actives |
| accounting | frais d’ouverture de route |

**Pas de nouvelle table Dexie** obligatoire pour v1. Le brouillard / hex possédés pourront utiliser une table `mapProgress` en v2.

---

## 6. État d’avancement

### ✅ Fait (S1 — noyau géographie)

| Fichier | Rôle |
|---------|------|
| `src/shared/geography/mapCoordinates.js` | Coordonnées % 0–100 (transition) |
| `src/contexts/geography/domain/catalogs/HamletMapCatalog.js` | 10 hameaux (positions %) |
| `src/contexts/geography/domain/catalogs/WorldMapCatalog.js` | Métadonnées royaume |
| `buildHamletsMapView.js` | View model hameaux + accès |
| `buildWorldMapView.js` | View model monde + influence + partenaires |
| Tests unitaires associés | |

### ✅ Fait (S2 — pages + composition)

| Fichier | Rôle |
|---------|------|
| `bootMapContexts.js` | `waitForDatabaseReady`, `ensureHamletCatalog`, commerce léger |
| `mapSessionApi.js` | `getHamletsMapView`, `getWorldMapView`, `travelToHamlet`, `activateTradePartner` |
| `hamlets.html`, `world.html` | Entrées Vite + routes propres |
| `presentation/dom/maps/*` | Rendu SVG/DOM statique + contrôleurs |
| `vite.config.js` | routes `/hamlets`, `/world`, chunk `phaser` |

### ⬜ À faire

Voir sprints §8.

---

## 7. Structure cible des fichiers

```text
src/
├── shared/geography/
│   ├── mapCoordinates.js          ← existant (déprécié cartes après migration hex)
│   └── hexCoordinates.js          ← NOUVEAU
│
├── contexts/geography/
│   ├── domain/
│   │   ├── catalogs/
│   │   │   ├── HamletMapCatalog.js    ← + hex { q, r }
│   │   │   ├── WorldMapCatalog.js
│   │   │   └── HexAssetCatalog.js     ← NOUVEAU — manifest Kenney
│   │   └── world/
│   │       ├── hamletWorldDefinition.js
│   │       └── worldMapDefinition.js
│   └── application/queries/
│       ├── buildHamletsMapView.js
│       └── buildWorldMapView.js
│
├── composition/
│   ├── bootMapContexts.js
│   └── mapSessionApi.js
│
├── presentation/
│   ├── phaser/                        ← NOUVEAU
│   │   ├── shared/
│   │   │   ├── createPhaserGame.js
│   │   │   ├── loadKenneyAtlases.js
│   │   │   └── HexMapSceneBase.js
│   │   ├── hamlets/
│   │   │   ├── bootstrapHamletsMap.js
│   │   │   └── HamletsHexScene.js
│   │   └── world/
│   │       ├── bootstrapWorldMap.js
│   │       ├── WorldHexScene.js
│   │       └── layers/
│   │           ├── TerrainLayer.js
│   │           ├── RoutesLayer.js
│   │           ├── CitiesLayer.js
│   │           └── KingdomLayer.js
│   ├── dom/maps/                      ← existant — panneaux HTML
│   └── pages/
│       ├── hamlets/main.js            ← brancher Phaser
│       └── world/main.js
│
public/resources/kenney_hexagon-pack/  ← assets + PNG atlases
```

---

## 8. Sprints

| Sprint | Focus | Critères de sortie |
|--------|--------|-------------------|
| **S2.5** | Sandbox hex | Page ou scène dev : grille 12×12, terrain Kenney, clic → q/r, hover, pan/zoom, test persistance hex optionnel |
| **S3** | Phaser `/world` | Canvas hex + panneau commerce HTML ; routes ; clic capitale → `/hamlets` |
| **S4** | Phaser `/hamlets` | Marqueurs hameaux (états visuels) ; voyage → `/game` via `mapApi` |
| **S5** | Intégration | Lien admin commerce → `/world` ; anneau royaume = hex débloqués ; cache PWA assets ; doc README |
| **S6** | Polish (optionnel) | Brouillard, tweens routes, navires, fond parchemin |

### S2.5 — Hex Map Sandbox (détail)

Objectif : valider **assets + math + Phaser** avant de toucher aux vraies pages.

```text
- [ ] hexCoordinates.js + tests (round-trip axial ↔ pixel)
- [ ] HexAssetCatalog.js (terrain + 3 bâtiments)
- [ ] Vérifier / ajouter PNG spritesheets Kenney
- [ ] hex-sandbox.html (ou route /hex-sandbox dev-only)
- [ ] Scène : 12×12, 5 terrains, 1 port, 1 forêt, 1 mine, 1 ville
- [ ] Clic hex → log { q, r } + panneau debug
- [ ] Hover → contour hex (Graphics)
- [ ] Caméra : drag pan + molette zoom
- [ ] (Option) sauver 1 ville en Dexie → reload même hex
```

### S3 — World Phaser (détail)

```text
- [ ] Migrer villes TradeMapCityCatalog → hex { q, r }
- [ ] worldMapDefinition.js (mer, côtes, terres)
- [ ] WorldHexScene : terrain + villes + routes (Graphics courbes portées depuis renderTradeMap)
- [ ] KingdomLayer : rayon / masque basé sur view.kingdom.influence
- [ ] world/main.js : bootMapContexts → bootstrapWorldMap + WorldMapController (panneau)
- [ ] activateTradePartner → refresh scène
- [ ] Tests : view model inchangés ; scène testée via mock mapApi (pas WebGL Jest)
```

### S4 — Hamlets Phaser (détail)

```text
- [ ] Migrer HamletMapCatalog → hex
- [ ] hamletWorldDefinition.js (petite grille royaume)
- [ ] HamletsHexScene : tuiles + sprites état (actif / débloqué / verrouillé)
- [ ] Clic débloqué → panneau → travelToHamlet → /game
- [ ] Hameau actif : surbrillance + lien « Entrer »
```

---

## 9. Contrat `mapApi` (inchangé en esprit)

```js
{
  getHamletsMapView(),           // → { activeHamletId, hamlets: [{ id, access, map: { hex } }], … }
  getWorldMapView(),             // → { kingdom, cities, connections, partners }
  travelToHamlet(hamletId),      // setActiveHamletId + persist ; refuse locked
  activateTradePartner(id),      // commerce + accounting
}
```

**Refresh :** après toute commande, la page appelle `get*MapView()` puis `scene.refresh(view)`.

---

## 10. Phaser : utilitaires moteur vs scripts maison

| Responsabilité | Outil |
|----------------|-------|
| Chargement atlas, sprites | Phaser `load.atlas` |
| Pan / zoom | `Camera` + input pointer |
| Layers, profondeur | `Container` |
| Routes, surbrillance | `Graphics` ou sprites overlay |
| Tweens (v2) | Phaser tweens |
| **Math hex** axial ↔ pixel, voisins, distance | **`shared/geography/hexCoordinates.js`** |
| Règles métier | `contexts/*` via `mapApi` |

Phaser ne fournit pas de grille hex « Civilization » intégrée ; le module `hexCoordinates` reste petit, testé, réutilisable (minimap, éditeur, IA plus tard).

---

## 11. Intégration avec le reste du jeu

| Zone | Lien |
|------|------|
| Carrousel HUD (`HamletTravelMenu`) | Conserver pour voyage rapide in-game ; option lien « Carte du royaume » → `/hamlets` |
| Admin commerce | « Ouvrir la carte » → `location.href = '/world'` (remplace overlay modal) |
| `multiple_hamlet.plan.md` | Mettre à jour § non-objectifs : carte pays **incluse** en 2D stratégique (hors 3D) |
| Déco voisins 3D | Inchangée — `neighborHamletDecoSpots` reste liée à la grille Three.js, pas à la carte hex |

---

## 12. Tests

| Couche | Type |
|--------|------|
| `hexCoordinates` | Unitaire — round-trip, voisins, `pixelToAxial` au centre d’un hex |
| `buildHamletsMapView` / `buildWorldMapView` | Unitaire + fake-indexeddb |
| `mapSessionApi.travelToHamlet` | Intégration — refuse locked |
| `HexAssetCatalog` | Unitaire — chaque clé gameplay résout une frame |
| Scènes Phaser | Minimal — mock `mapApi`, vérifier `refresh()` recrée N marqueurs |
| E2E manuel | Resize, voyage, activation route, retour `/game` même hameau |

---

## 13. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| PNG Kenney absents du repo | Bloquer S2.5 tant que `sprites.png` ne charge pas |
| Orientation mélangée | Figée pointy-top ; test snapshot sandbox |
| Bundle lourd | Charger seulement `hexagonTerrain` + `hexagonBuildings` par page |
| Deux onglets Dexie | Même origine ; éviter deux onglets `/game` + édition carte sans refresh |
| Duplication règles commerce | Toute action passe par `mapApi` → commandes commerce existantes |
| Carte « plateau de jeu » trop visible | Grille atténuée ; fond parchemin ; hex fort seulement au hover |
| Dérive % vs hex | Migration unique catalogues ; tests sur `hex` obligatoires |

---

## 14. Première PR utile (après ce document)

1. `hexCoordinates.js` + tests  
2. `HexAssetCatalog.js` + vérification PNG Kenney  
3. `hex-sandbox.html` + scène Phaser minimale  
4. (Ensuite) migration `HamletMapCatalog` / `TradeMapCityCatalog` vers `{ q, r }`  
5. S3 `WorldHexScene` en remplacement du canvas SVG statique  

---

## 15. Références rapides — fichiers existants

| Fichier | Rôle actuel |
|---------|-------------|
| `src/composition/bootMapContexts.js` | Bootstrap pages carte |
| `src/composition/mapSessionApi.js` | API présentation |
| `src/contexts/geography/application/queries/buildHamletsMapView.js` | VM hameaux |
| `src/contexts/geography/application/queries/buildWorldMapView.js` | VM monde + influence |
| `src/presentation/dom/maps/WorldMapController.js` | UI monde (statique) |
| `src/presentation/dom/maps/HamletsMapController.js` | UI royaume (statique) |
| `src/contexts/commerce/domain/catalogs/TradeMapCityCatalog.js` | Villes commerce (%, à migrer) |
| `package.json` | `phaser@4.2.1` installé |

---

*Dernière mise à jour : conception hex Kenney — suite S1–S2 statiques.*
