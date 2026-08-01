# Plan Clean Architecture — sortir du strangler

> **Cap :** un repo où les règles de jeu vivent dans les BCs, le câblage dans `composition/`, le rendu dans `ui/` + `presentation/`, **sans couche intermédiaire legacy** (`src/js/acl`, service locator `window.app`) qui force un « faux » DDD.
>
> Ce n’est **pas** « 100 % Evans ». C’est **DDD/CA proportionné** (policies + snapshots, factories explicites) — déjà posé dans les contextes — **plus** l’élimination du scar tissue strangler.
>
> Document vivant. `src/archi.md` reste l’historique / YAGNI ; **ce fichier est le cap opérationnel.**

---

## 1. Pourquoi on n’est pas encore « propre »

Les BCs (`contexts/`) et le pipeline ECS sont sains. Ce qui pollue encore la Clean Architecture :

| Couche parasite | Rôle aujourd’hui | Pourquoi ça empêche le CA |
|---|---|---|
| `src/js/acl/` (~1,8 kLOC) | Façade `getOrCreate*Context().…` + réexports domaine | L’UI et même `composition/` parlent à un **pseudo application layer** hors des contextes |
| `AppRegistry` / `window.app` | Service locator global | Graphe de dépendances **invisible** ; impossible de lire « qui dépend de quoi » |
| `src/js/utils/` (~2 kLOC) | Helpers mesh / DOM / loader | « Legacy path » pour du code qui est en réalité presentation/UI |
| Composition → ACL | `bootGameContexts`, `create*Context` passent par `js/acl` | Le composition root **dépend du strangler** au lieu de le remplacer |
| `scene.js` encore mixte | Rendu + lectures ACL + touches HUD | Le moteur de rendu reste un **point d’entrée métier** |

Le strangler a déjà mangé stores / CommerceService / UI sous `js/`. **Ce qu’il reste, c’est la cicatrice.** Objectif : l’enlever.

---

## 2. État cible (fin de plan)

```
src/
  contexts/<bc>/{ domain, application, infrastructure [, presentation] }/
  composition/          ← seul câblage : create*Context, boot*, tick, bridges
  presentation/three/   ← WebGL ; contextes injectés à la création (pas getOrCreate)
  ui/                   ← DOM ; reçoit des API application injectées au boot
  engine/               ← ECS + GameLoop (inchangé)
  shared/               ← identity, catalogs, time, defaults
  infrastructure/       ← multiplayer + transverse réel
  core/                 ← schéma Dexie
# SUPPRIMÉ :
#   src/js/acl/
#   src/js/utils/
#   window.app comme spine de production
```

**Flèches autorisées :**

```
ui / presentation  ──→  (API injectées par composition, ou adapters locaux minces)
composition        ──→  contexts / engine / shared / ui|presentation (wiring only)
contexts/*/domain  ──→  shared (+ son domain)
contexts/*/application ──→ domain + ports + shared
contexts/*/infrastructure ──→ son contexte + techno
engine             ──→  (rien du projet métier)
```

**Critère de décision (inchangé) :**

> Cette règle survit-elle si on remplace Three.js ?
> - Oui → domaine / BC  
> - Non → `presentation/` ou `ui/`

**Critère de sortie du plan :**

1. `src/js/` n’existe plus (ou tombebeau vide &lt; 1 semaine).
2. `rg 'js/acl' src/composition src/ui src/presentation` → 0.
3. Aucun chemin de production ne lit `window.app.*` pour obtenir game / presenters / services.
4. `boundaries.test.js` interdit composition→js, ui|presentation→acl, ui|presentation→domain.
5. Les use cases et queries sont appelés via objets fournis au boot, pas via `getOrCreateXContext()` depuis l’UI.

---

## 3. Baseline (août 2026 — approximatif)

| Zone | ~LOC | Note |
|---|---:|---|
| `contexts/` | ~18k | Spine DDD — **garder** |
| `ui/` | ~14k | DOM — **garder**, changer *comment* on s’y branche |
| `presentation/` | ~8k | Three — **garder** le rendu, sortir le wiring métier |
| `composition/` | ~2,4k | **Élargir** (absorbe ce que l’ACL faisait) |
| `js/acl` + `js/utils` | ~3,8k | **À faire disparaître** |

Lots historiques d’`archi.md` largement faits : domain⊥js, commerce BC, garde-fou boundaries, UI hors `js/`, tick economy, place/bulldoze, catalog. **Ne pas les replanifier.**

---

## 4. Les barres (étapes grosses)

Chaque barre est jouable, testable, mergeable. Pas de big bang.

### Barre A — Inverser composition ⊥ ACL ✅

**But :** le composition root ne passe plus par le strangler.

| | |
|---|---|
| **Meurt** | `bootGameContexts` / `create*Context` qui importent `js/acl` ; `getOrCreate*` comme entrée composition |
| **Reste** | ACL pour l’UI *temporairement* ; corps des `create*Context` |
| **Travail** | `bootGameContexts` appelle `createParcelsContext()` etc. en direct ; ports cross-BC câblés dans composition sans ACL ; `getOrCreate*` ne sert plus qu’aux call sites UI/presentation |
| **Sortie** | `rg 'js/acl' src/composition` = 0 |
| **Status** | ✅ Fait (août 2026) — modules sortis de l’ACL : `supplyTimeLabels`, `budgetReadyGate`, `constructionTreasuryBridge`, `AppRegistry` + `appServices` ; ACL = re-exports pour l’UI |

---

### Barre B — Tuer AppRegistry comme spine de production ✅

**But :** graphe d’objets explicite au boot, plus de service locator.

| | |
|---|---|
| **Meurt** | `window.app` / `AppRegistry.get` comme API prod ; `getAppService('…')` dans composition ; `registerAppService` partout « au cas où » |
| **Reste** | miroir debug optionnel derrière un flag ; classes Panel |
| **Travail** | `GameSessionBootstrap` / `initAppBoot` construit un `runtime` (game, gameUI, contexts, presenters) et le passe ; panels reçoivent des deps ou un `runtime` typé JSDoc |
| **Sortie** | 0 lecture prod de `window.app.*` pour services ; accounting composition sans locator |
| **Status** | ✅ Fait — `sessionRuntime` = SoT (typed + services map) ; `appRuntime` / getters lisent la session ; `AppRegistry` + `window.app` seulement si `NODE_ENV=test`, `import.meta.env.DEV`, ou `localStorage.anoria.debugAppRegistry=1` ; accounting/gameplay sans locator |

---

### Barre C — Dissoudre `js/utils` ✅

**But :** plus de package « legacy utils ».

| | |
|---|---|
| **Meurt** | `src/js/utils/` |
| **Reste** | la logique (hover mesh, EventBlocker, Loader, WebGL detector) **déplacée** |
| **Travail** | mesh helpers → `presentation/three/` ; EventBlocker / loader / WebGL → `ui/shell/` ou `shared/` ; neighbors scan → adapter parcels ou helper presentation |
| **Sortie** | aucun import `js/utils` depuis ui / presentation / contexts |
| **Status** | ✅ Fait — `meshUtils` + `sceneSpatialUtils` → `presentation/three/` ; `EventBlocker` / `ButtonStateManager` / `LoaderManager` / `WebGLResourceDetector` → `ui/shell/` ; DOM info → `ui/info/buildingInfoDom.js` |

---

### Barre D — `scene.js` / `game.js` = rendu + input seulement ✅

**But :** le tick et le HUD n’appartiennent plus à la scène.

| | |
|---|---|
| **Meurt** | imports ACL dans scene ; `getOrCreate*` fallbacks ; `getTreasurySnapshot` + `querySelector` funds/pop dans scene ; employment refresh comme side-effect HUD dans scene |
| **Reste** | mesh lifecycle, managers, raycast, `sync/`, camera/draw (gros volume OK) |
| **Travail** | `createScene({ parcels, supply, housing, … })` injecté ; HUD via `GameUI` / presenters depuis `runGameTick` ; scene ne connaît plus accounting |
| **Sortie** | `rg 'js/acl' src/presentation/three/scene.js` = 0 ; scene ne touche plus le DOM HUD |
| **Status** | ✅ Fait — deps injectés (parcels/supply/housing/construction/employment) ; `syncSessionHud` au tick + place/bulldoze ; funds hors scene ; `TimeManager` / `sessionRuntime` / `roadAccessIcons` directs ; `GameUI.resetInitialHud` |

---

### Barre E — Effondrer les façades ACL (dernier kilomètre UI) ✅

**But :** l’UI parle aux APIs application injectées.

| | |
|---|---|
| **Meurt** | `accounting.js` (~70 wrappers) ; orchestration employment dans ACL ; réexports domain depuis `supply.js` / `commerce.js` / `gameConfig.js` |
| **Reste** | éventuellement `ui/adapters/` minces (1 fichier / BC) si signatures DOM ≠ ports — puis suppression |
| **Travail** | boot injecte `{ getBalanceSheet, placeBuildingAtTile, … }` ; panels n’importent plus `js/acl/*` ; orchestration `syncEmploymentAfterBuildingChange` → application/composition |
| **Sortie** | `rg 'js/acl' src/ui src/presentation` = 0 ; `src/js/acl/` vide ou &lt; 100 LOC tombstone |
| **Status** | ✅ Fait — wrappers dans `composition/facades/` ; UI/presentation/main/infra pointent là (ou sources directes) ; `syncEmploymentAfterBuildingChange` dans composition ; `src/js/acl/` ≈ 50 LOC de re-exports deprecated |

---

### Barre F — Durcir les frontières + supprimer `src/js/` ✅

**But :** empêcher le retour du strangler ; arborescence = modèle mental.

| | |
|---|---|
| **Meurt** | package `src/js/` ; règles boundaries trop permissives |
| **Reste** | spine actuelle |
| **Travail** | étendre `boundaries.test.js` : interdit `composition→js`, `ui|presentation→js`, `ui|presentation→contexts/*/domain` ; optionnel forbid `window.app =` hors un seul fichier boot ; supprimer dossier `js/` ; pointer `archi.md` / READMEs vers ce plan |
| **Sortie** | critères §2 tous verts ; CI rouge si ACL/utils réapparaissent |
| **Status** | ✅ Fait — `src/js/` supprimé ; `boundaries.test.js` refuse js/ + domain depuis ui/presentation ; tests retargetés vers `composition/facades` |

---

## 5. Ordre et effort (indicatif)

| Barre | Effort | Priorité | Débloque |
|---|---|---|---|
| **A** Composition ⊥ ACL | 1–2 j | 🔴 | Tout le reste |
| **B** Fin du locator | 1–2 j | 🔴 | Injection UI propre |
| **C** utils → bons dossiers | ½–1 j | 🟠 | Suppression `js/` |
| **D** scene/game mince | 1–2 j | 🟠 | CA lisible au tick |
| **E** Collapse ACL UI | 2–3 j | 🔴 | Fin strangler |
| **F** Boundaries + delete `js/` | ½ j | 🔴 | Cap verrouillé |

**Séquence recommandée :** A → B → C → D → E → F.  
C et D peuvent chevaucher après A. E exige A+B.

---

## 6. Non-objectifs (ne pas faire)

| Tentation | Décision |
|---|---|
| Aggregates riches / bus d’événements généralisé / CQRS bus / event sourcing journal | **Non** |
| Conteneur DI / TypeScript « pour l’archi » | **Non** |
| Un BC par reste (Loans, Objectives, Citizens…) par défaut | **Non** — policies/catalogs tant que la douleur n’est pas mesurée |
| Réécrire `scene.js` / AssetManager « en DDD » | **Non** — on retire le **wiring métier**, pas le moteur de rendu |
| Inventer de nouveaux BCs pour absorber l’ACL | **Non** — on **supprime** la couche, on n’en ajoute pas |
| Big bang « delete js/ demain » | **Non** — barres A→F |

Réinterprétation d’`archi.md` « ne pas réécrire `src/js/` » : ne pas réécrire le **rendu** comme du domaine. **Oui**, faire mourir le package ACL/utils en déplaçant les call sites vers composition + injection.

---

## 7. Comment mesurer l’avancement

```bash
# Composition propre
rg 'js/acl' src/composition || true

# Surfaces sans ACL
rg 'js/acl' src/ui src/presentation || true

# Locator
rg 'window\.app' src --glob '**/*.js' || true

# Taille cicatrice
find src/js -name '*.js' | xargs wc -l
```

À chaque barre : `npm test` (dont `boundaries`) vert + jeu jouable (place, bulldoze, tick, un panneau compta).

---

## 8. Prochaine action

**Cap A→F atteint.** Suite optionnelle hors plan : amincir `composition/facades/` (appeler les contextes directement depuis l’UI injectée), rafraîchir `src/archi.md` pour coller au code.

~~A + B + C + D + E + F done.~~
