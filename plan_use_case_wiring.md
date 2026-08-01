# Plan — câblage par use case (post-strangler)

> **Cap :** remplacer `composition/facades/` (ACL déplacé) par un **câblage Clean Architecture** : la presentation ne tire plus le métier via `getOrCreate*` / wrappers ; elle **reçoit** des APIs application (commands / queries) assemblées au boot dans `composition/`, selon la règle de dépendance de Robert Martin, dans les bons bounded contexts.
>
> **Priorité :** uniquement ce qui change le graphe de dépendances. Les dettes résiduelles sont **notées**, pas traitées dans ce plan.
>
> Suite directe de [`docs/plan_ca.md`](docs/plan_ca.md) (barres A→F ✅). Ce fichier est le **cap opérationnel suivant**.

---

## 1. Diagnostic (pré-plan → post-barres)

| Couche | Avant | Après barres 1–5 |
|---|---|---|
| `contexts/*/domain` | Globalement propre | — |
| `contexts/*/application` | Sous-utilisés depuis le DOM | Exposés via `sessionApi` (BC slices) |
| `composition/` | Assemble via **facades** | `bootGameContexts` → `sessionApi` + `*Ops` (tests / orchestration) |
| `composition/facades/` | ~1,6 kLOC wrappers | **Absent** |
| `presentation/**` | ~44 fichiers → facades | 0 import facades / `*Ops` / `getOrCreate*` (sauf `GameSession`) |
| `sessionRuntime` | SoT session | Bind `sessionApi` + shell ; panels via `requireSession*Api()` |

**Verdict (cible atteinte) :** règle de dépendance Martin respectée pour presentation → application injectée ; dettes §6 hors scope.

---

## 2. Règle cible (Martin + Evans)

```
presentation (dom | three)
    →  ports / APIs injectées (interfaces stables, pas de getOrCreate)
         ↑ fournies uniquement par
composition/   (composition root — seul endroit qui new/wire)
    →  contexts/*/application  (commands, queries, workflows)
          →  contexts/*/domain
          →  ports (interfaces)
contexts/*/infrastructure  →  implémente les ports (Dexie, etc.)
```

**Interdit (cible) :**
- `presentation/**` → `composition/facades/**`
- `presentation/**` → `getOrCreate*Context`
- `presentation/**` → `contexts/*/domain`
- `contexts/**` → `composition/**` (sauf cas listés en dette)

**Autorisé :**
- `presentation` reçoit un objet **immuable de session** (ou des deps panel-scoped) au constructeur / `init*(api)`
- `composition` appelle les use cases et branche les ports cross-BC
- Un BC n’importe pas un autre BC : cross-BC uniquement via **ports** câblés dans composition

**Critère de décision (inchangé) :**

> Cette règle survit-elle si on remplace Three.js / le DOM ?
> - Oui → domaine / application BC  
> - Non → `presentation/`

**Critère « façade vs use case » :**

> Si le fichier ne fait que `getOrCreateX().methodeY(...)`, ce n’est **pas** un use case : c’est un patch. Le vrai use case vit dans `contexts/X/application/` ; composition l’injecte.

---

## 3. Forme du câblage (contrat)

Au boot (`bootGameContexts` → `createGame`), composition construit :

```text
sessionApi = {
  construction: {
    placeBuildingAtTile, bulldozeBuildingAtTile, placeBuildingRecord,
    findBuildingAtTile, getBuildingById, getBuildingField, updateBuildingFields, …
  },
  // accounting, supply, … — barres suivantes
}
```

Implémentation live : [`src/composition/sessionApi.js`](src/composition/sessionApi.js) + champ `sessionRuntime.sessionApi`.

- **Commands** (écriture) et **queries** (lecture) explicites — pas d’accès aux repositories depuis le DOM.
- Les panels feront `initX(sessionApi.…)` (Barres 2–4) ; le flux Three place/bulldoze utilise déjà `sessionApi.construction`.
- `appRuntime.getX()` disparaît progressivement (Barre 2).
- Les **view-models de presentation** restent dans `contexts/*/presentation` ou `presentation/dom/**` — **pas** dans une facade globale.

---

## 4. Ce qui meurt / ce qui reste

| | |
|---|---|
| **Meurt** | `composition/facades/*` comme API publique ; wrappers `getOrCreate*` pour l’UI ; `appRuntime` comme service locator de panels |
| **Reste** | `contexts/*/application` (enrichi si un wrapper cachait une vraie règle) ; `sessionRuntime` ; `create*Context` ; bridges composition (`syncSessionHud`, `constructionTreasuryBridge`, …) |
| **Ne pas inventer** | Nouveaux BCs pour absorber des wrappers ; un « application layer » parallèle hors `contexts/` |

---

## 5. Barres (priorité architecture uniquement)

Chaque barre = jouable + `npm test` vert (dont `boundaries`) + un parcours manuel (place / tick / un panneau).

### Barre 1 — Contrat `sessionApi` + pilote vertical ✅

**But :** prouver le cycle Martin sur **une** surface bout-en-bout.

| | |
|---|---|
| **Pilote** | **Construction** (place / bulldoze / nature spawn / neighbors persist) |
| **Fait** | `composition/sessionApi.js` (`assembleSessionApi` + `createConstructionSessionApi`) ; `bootGameContexts` assemble et retourne `construction` + `sessionApi` ; `bindSessionRuntime({ sessionApi })` ; `game.js` place/bulldoze via `sessionApi.construction` (**plus** `facades/construction` ni `getOrCreateConstructionContext` sous `presentation/three/`) ; `ResourceManager` / `syncTileNeighborsPass` reçoivent les deps injectées depuis `construction` |
| **Sortie** | Flux place/bulldoze Three sans facade ; tests `tests/composition/sessionApi.construction.test.js` |
| **Reste hors barre** | DOM panels (`BuildingInfoPanel`, bilan enrichment, storage) importent encore `facades/construction` — Barre 4 |

---

### Barre 2 — Tuer `appRuntime` comme spine presentation ✅

**But :** le plus gros aimant de dépendances (32 fichiers).

| | |
|---|---|
| **Meurt** | Imports `composition/facades/appRuntime` depuis `presentation/**` |
| **Fait** | Nouveau [`composition/sessionShell.js`](src/composition/sessionShell.js) (pause/popup/handlers/time — shell ≠ BC) ; 32 fichiers presentation retargetés ; `facades/appRuntime.js` = re-exports legacy pour tests / hors presentation |
| **Sortie** | `rg "facades/appRuntime" src/presentation` = 0 |
| **Reste** | Locator shell encore via getters (`getPopupManager`…) — acceptable pour Barre 2 ; injection constructeur panel = raffinement ultérieur (dette) |

---

### Barre 3 — Accounting application injecté (gros métier UI) ✅

**But :** remplacer `facades/accounting.js` + `accountingGame.js` + presenters VM.

| | |
|---|---|
| **Meurt** | Imports `facades/accounting*` / `facades/budget` depuis `presentation/**` |
| **Fait** | `sessionApi.accounting` (`createAccountingSessionApi`) ; `bootGameContexts` assemble accounting + cityAssets ; panels/compta + admin finances/work/commerce + info/objectifs via `requireSessionAccountingApi()` ; VMs purs importés depuis `contexts/accounting/presentation` |
| **Sortie** | `rg "facades/accounting\|facades/budget" src/presentation` = 0 |
| **Reste** | Facade accounting encore utilisée par tests / composition bridges — suppression package = Barre 5 |

---

### Barre 4 — Autres BCs presentation ✅

**But :** même pattern, par BC, **sans** nouvelle abstraction globale.

| | |
|---|---|
| **Meurt** | Imports `composition/facades/*` depuis `presentation/**` (sauf déjà traités B1–B3) |
| **Fait** | `sessionApi.{supply,employment,housing,commerce,parcels}` ; objectifs persistés via `sessionApi.accounting` + catalogue statique `composition/accountingObjectivesCatalog.js` ; `building-identity` → `shared/` ; `gameSession` → `createGameSessionContext` ; `sceneSpatialUtils` → scan parcels infra direct |
| **Sortie** | `rg "composition/facades" src/presentation` = 0 ; plus aucun `getOrCreate*Context` sous presentation (hors boot `createGameSessionContext`) |
| **Ordre fait** | supply, employment, housing, commerce, parcels, objectives, construction DOM restant |

---

### Barre 5 — Effondrer le package `facades/` + durcir boundaries ✅

**But :** rendre la régression impossible.

| | |
|---|---|
| **Meurt** | Dossier `composition/facades/` |
| **Fait** | Wrappers utiles → `composition/*Ops.js` (+ `sessionShell`, catalogues) ; tests / main / multiplayer retargetés ; `boundaries.test.js` : facades absentes + presentation interdite d’importer `*Ops` / `getOrCreate*Context` (sauf game session) ; `employmentOps` réexporte l’API EmployeeHelper pour les tests |
| **Sortie** | Critères §2 + §7 ; `npm test` vert (652) |

---

## 6. Dettes résiduelles (plus tard — ne pas bloquer)

Notées volontairement hors barres 1–5 :

| Dette | Pourquoi plus tard |
|---|---|
| ~~`composition/runGameTick` → `CleanupNotificationPresenter` (DOM)~~ | ✅ injecté depuis `game.js` (`notifyBudgetCleanup`) |
| ~~`CityAssetsValuationAdapter` → `composition/createCityAssetsContext`~~ | ✅ collaborateur injecté ; câblé dans `createAccountingContext` / `bootGameContexts` |
| ~~Getters shell → injection panel (pilote compta)~~ | ✅ `init*(deps)` + câblage depuis `GameSessionBootstrap` ; `src/presentation/dom/compta` sans `requireSession*` / `sessionShell` |
| ~~Getters shell → injection admin (tranche 2)~~ | ✅ `initAdminSections(deps)` après sessionApi ; presenters via constructeur ; plus de script `initAdminSections` dans `index.html` |
| ~~Getters shell → BuildingInfo / ToolPanel / onboarding (tranche 3)~~ | ✅ `presentBuildingInfoSelection(ctx)` + `bindToolPanelDeps` + `initObjectives*` / `initTutorialPanel` ; scripts onboarding retirés de `index.html` |
| Getters shell résiduels (`PlaybackControls`, `PopupManager`, `ResourceManager`, `syncTileNeighborsPass`, `ParametersPanel`, `buttons.js`) | **Tranche 4** éventuelle / hygiène |
| `scene.js` / `game.js` volume rendu | Pas un problème de règle de dépendance tant que le métier n’y revient pas |
| Miroir debug `AppRegistry` / `window.app` | OK derrière flag ; ne pas en refaire une spine |
| Orchestrations composition (`syncEmploymentAfterBuildingChange`, bridges trésorerie) | Légitimes au root **ou** à monter en workflow application si un BC devient propriétaire clair — juger au cas par cas |
| Doc stale (`docs/refactor_ui.md`, `archi.md`, chemins `src/ui`) | Cosmétique archi |
| Colocaliser CSS à côté des panels | Organisation DOM, pas CA |
| `shared/ui/UiDefaults` naming | Pas du CSS ; éventuel rename `shared/config` |
| Aggregates riches / domain events bus / CQRS bus | Non-objectif (cf. `plan_ca` §6) |
| Découper accounting en sous-BCs (prêts, objectifs…) | Seulement si douleur mesurée |

---

## 7. Mesure

```bash
# Cicatrice facade
rg -l 'composition/facades' src/presentation | wc -l
wc -l src/composition/facades/*.js | tail -1

# Interdits presentation
rg 'getOrCreate\w+Context' src/presentation --glob '*.js' || true
rg "facades/appRuntime" src/presentation || true

# Boundaries
npm test -- tests/architecture/boundaries.test.js
```

Cible fin de plan :

1. `src/composition/facades/` absent (ou tombebeau vide).
2. 0 `getOrCreate*Context` sous `src/presentation/`.
3. 0 import `composition/facades` depuis `presentation/`.
4. Boot construit `sessionApi` (ou équivalent) et le passe aux surfaces DOM/Three.
5. `boundaries.test.js` encode 2–3.

---

## 8. Non-objectifs

| Tentation | Décision |
|---|---|
| Réécrire le domaine accounting « pour faire joli » | **Non** — brancher ce qui existe |
| Conteneur DI / framework | **Non** |
| Déplacer les use cases hors `contexts/` vers `composition/application` | **Non** — composition **câble**, application **vit** dans le BC |
| Big bang 44 panels en un commit | **Non** — barre 1 pilote, puis 2→5 |
| Traiter la liste §6 dans les mêmes PR | **Non** |

---

## 9. Ordre

```text
1 pilote sessionApi (construction ou trésorerie)
  → 2 appRuntime mort
    → 3 accounting injecté
      → 4 autres BCs
        → 5 delete facades + boundaries
```

**Plan barres 1→5 : terminé.** Suite éventuelle = dettes §6 (hors ce plan).

~~Barre 1 (construction sessionApi) done.~~  
~~Barre 2 (sessionShell, plus de facades/appRuntime en presentation) done.~~  
~~Barre 3 (sessionApi.accounting, panels hors facades accounting*) done.~~  
~~Barre 4 (autres BCs presentation hors facades) done.~~  
~~Barre 5 (delete facades + boundaries) done.~~
