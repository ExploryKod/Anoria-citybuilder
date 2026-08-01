# Architecture — état des lieux et cap de refactor

> Objectif : finir la migration DDD **déjà engagée**, sans ajouter de complexité inutile.
> Règle directrice : on ne crée une abstraction que quand une douleur mesurée la réclame (YAGNI).

---

## 1. État des lieux (mesuré)

325 fichiers JS, ~49 300 lignes.

| Zone | LOC | Rôle | Statut |
|---|---:|---|---|
| `src/js/` | 33 367 | Legacy : rendu Three.js, UI DOM, services de jeu | 🟡 à éroder |
| `src/contexts/` | 12 846 | 6 bounded contexts (DDD) | ✅ en place |
| `src/composition/` | 1 449 | Composition roots (câblage DI) | ✅ en place |
| `src/js/acl/` | 1 432 | Anticorruption layer legacy → BC | 🟡 fuit |
| `src/shared/` | 666 | Shared Kernel (`building-identity`, `city-assets`) | ✅ |
| `src/engine/` | 324 | Generic subdomain : ECS + Pipeline | ✅ |
| `src/core/` | 49 | Schéma Dexie | ✅ |

**Bounded contexts existants** : `accounting`, `construction`, `employment`, `housing`, `parcels`, `supply`.
Chacun suit `domain / application (commands, queries, ports) / infrastructure (adapters)`.

### Trajectoire — la migration a 4 jours

| Date | `src/js/` | `contexts/` | `acl/` |
|---|---:|---:|---:|
| 2025-11-29 | 27 250 LOC | 0 fichier | 0 |
| 2025-12-17 | 37 904 LOC | 0 fichier | 0 |
| 2026-07-31 | 33 949 LOC | **189 fichiers** | 9 |

Tous les fichiers d'ACL datent du **28 au 31 juillet 2026**. Les 6 contextes ont été créés en quatre jours.

Deux conséquences directes, et c'est ce qui explique la sensation de complexité :

1. **Les deux modèles coexistent.** On a ajouté 12 846 LOC de contextes et retiré ~4 000 LOC de legacy. Le code a donc *grossi* — normal et attendu en strangler fig, mais seulement si la suppression du legacy suit. C'est le point de discipline n°1.
2. **Rien n'a eu le temps de se stabiliser.** Ce qu'on regarde n'est pas une architecture qui a échoué, c'est un chantier au quatrième jour. Le juger comme un état final serait injuste ; le laisser dans cet état six mois serait le vrai échec.

### Ce qui est déjà sain — à ne pas casser

- **Zéro import inter-contextes.** Vérifié sur les 6 BC : aucun ne référence un autre. C'est le point le plus dur du DDD et il est acquis.
- **Les ports sont de vraies interfaces** (`application/ports/*.js`), les adapters Dexie sont injectés par `composition/create*Context.js`. La DIP est correctement appliquée sur l'axe persistance.
- **Un seul composition root par contexte**, plus `createGameRuntime.js` pour le pipeline ECS. Pas de conteneur DI magique : des factories explicites. C'est le bon niveau de sophistication.
- **67 fichiers de test**, dont 46 sur `contexts/` et `engine/`. Le domaine testé est testé sans DOM ni Dexie réel.
- Les policies (`RoadAccessPolicy`, `HouseEvolutionPolicy`, `FarmYieldPolicy`…) sont des fonctions pures. Pas d'entités anémiques enveloppées de getters inutiles — c'est du DDD tactique **proportionné** à un jeu.

---

## 2. Les 5 dettes réelles

Classées par coût de correction croissant / bénéfice décroissant.

### D1 — Dépendance inversée : `contexts/` importe `src/js/` (17 occurrences) ⚠️ bloquant

C'est la seule vraie violation de la règle de dépendance. Le domaine dépend du legacy, donc le legacy ne peut pas mourir.

| Fichier fautif | Importe | Nature |
|---|---|---|
| `contexts/accounting/domain/policies/LedgerIdempotencePolicy.js:10` | `js/stores/ledgerBusinessKeys.js` | **domaine → legacy** |
| `contexts/supply/domain/manufacturing/FactoryStoragePolicy.js:1` | `js/game/config.js` | **domaine → legacy** |
| `contexts/accounting/application/services/Record*.js` (×7) | `js/stores/ledgerBusinessKeys.js` | application → legacy |
| `contexts/accounting/application/queries/treasury/GetTreasurySnapshot.js:1` | `js/game/config.js` | application → legacy |
| `contexts/accounting/infrastructure/adapters/persistence/session/*` (×2) | `js/stores/SessionLedgerBuffer.js`, `JournalManager.js` | infra → legacy (tolérable) |
| `contexts/parcels/infrastructure/presentation/roadAccessIcons.js:1` | `js/game/modules/StatusIconHelper.js` | infra → legacy (tolérable) |
| `contexts/parcels/infrastructure/spatial/SceneSpatialNeighborhoodAdapter.js:1` | `js/utils/utils.js` | infra → legacy (tolérable) |

**Distinction importante** : un *adapter d'infrastructure* qui appelle le legacy, c'est **le rôle prévu** d'un adapter — on le laisse. Ce qui doit disparaître, c'est `domain/` et `application/` qui importent `js/`.

### D2 — `config.js` est un god-object métier

`src/js/game/config.js` (197 lignes) contient des **règles de domaine** : `employment.sectors`, `buildingNeeds`, `factoryEmployeeNeeds`, `factoryMaxStorage`, `citizens.minWorkingAge/retirementAge`, `budget.commercialRouteFee`. Ces valeurs sont du langage ubiquitaire, pas de la configuration technique. Elles sont importées directement par le domaine (cf. D1).

### D3 — Règles métier restées dans l'UI (duplication active)

- `ui/compta/prets/PretsPanel.js` : taux via `LoanRatePolicy` (ACL `accountingLoans`) — plus de duplication locale.
- `ui/onboarding/ObjectivesTracker.js` : seuils via `ObjectiveCatalog` (éviter duplication inline).
- `js/game/managers/BudgetProcessor.js` : arbitrage budgétaire par tour, hors contexte.
- `js/game/services/CommerceService.js` (804 LOC) : règles de contrats, limites d'import/export, stocks — le plus gros bloc de domaine encore hors BC.

### D4 — L'ACL fuit dans les deux sens

- **Entrant** : 12 fichiers de `src/js/` importent `contexts/**` en contournant `acl/` — tous vers `accounting/domain/policies/*PresentationPolicy.js` (`RealtimeBudgetPresenter.js:9`, `CityLedgerPresenter.js:5`, `BalanceSheetPresenter.js:5`, `finances-section.js:2`…).
- **Sortant** : `js/acl/accountingGame.js` fait 644 lignes. Un ACL traduit ; celui-ci **orchestre**. C'est devenu une façade applicative déguisée.

### D5 — Les "presentation policies" ne sont pas du domaine

`accounting/domain/policies/` contient `BalanceSheetPresentationPolicy`, `CityLedgerPresentationPolicy`, `RealtimeBudgetPresentationPolicy`, `GeneralLedgerPresentationPolicy` — elles produisent des view models (libellés, `formatEuroOrNa`). Elles n'ont pas leur place dans `domain/`, ce qui explique mécaniquement D4-entrant : l'UI a *besoin* d'elles, donc elle perce la couche.

Note connexe : `domain/policies/JournalFinancialStatementsPolicy.js:4` importe `infrastructure/.../journalAggregations.js` — seule violation domaine → infra *intra-contexte*.

### D6 — Le vrai couplage n'est pas l'ACL : ce sont les globals et les stores 🔴

L'ACL est du couplage **visible, nommé, documenté**. Ce n'est pas lui qui rend le projet difficile. Le graphe de dépendances réel passe par `window` :

| Global | Occurrences |
|---|---:|
| `window.popupManager` | 100 |
| `window.game` | 72 |
| `window.app` | 40 |
| `window.tutorialManager` | 24 |
| `window.buttonStateManager` | 18 |
| `window.commerceSectionManager` | 14 |

Ces ~280 accès sont des arêtes du graphe que ni le compilateur, ni un test d'architecture, ni une recherche d'imports ne voient. **C'est la source principale de la complexité ressentie** — bien plus que les 1 432 lignes d'ACL.

Cas le plus net, Commerce : `CommerceService.js:281` et `:737` lisent `window.commerceSectionManager.goodsData`. Le service métier lit donc l'état de l'UI, à travers un global, **et** via `localStorage` (`CommerceStore` sert de bus inter-modules entre le service et la section UI). Deux canaux implicites en sens inverse de la dépendance normale. Aucun DDD ne survivra à ça tant que ça reste.

**Ce couplage-là est prioritaire sur D3, D4 et D5.**

---

## 3. La cible

Quatre couches, une seule règle : **les flèches ne pointent que vers l'intérieur.**

```
                    ┌──────────────────────────────────────┐
   composition/  →  │  infrastructure  (Dexie, Three, DOM) │   adapters
                    ├──────────────────────────────────────┤
                    │  application  (commands, queries,    │   use cases
                    │                ports = interfaces)   │
                    ├──────────────────────────────────────┤
                    │  domain  (policies, VO, snapshots)   │   règles pures
                    └──────────────────────────────────────┘

   src/ui/ (DOM) + src/presentation/ (Three)  ──→ src/js/acl/ ──→ composition/ ──→ contexts/
   engine/  ne dépend de rien   ; contexts/ ne dépend pas de engine/
```

| Couche | Peut importer | Ne peut jamais importer |
|---|---|---|
| `contexts/*/domain` | son propre `domain`, `shared/` | `application`, `infrastructure`, `js/`, dexie, three, DOM |
| `contexts/*/application` | son `domain`, ses `ports`, `shared/` | `infrastructure`, `js/`, un autre contexte |
| `contexts/*/infrastructure` | tout son contexte, `js/`, dexie, three | un autre contexte |
| `engine/` | rien | `contexts/`, `js/`, dexie, three |
| `composition/` | tout | — (c'est le seul endroit qui a le droit de tout voir) |
| `src/js/` | `js/acl/` uniquement | `contexts/**` en direct |

---

## 4. Plan de refactor — par lots livrables

Chaque lot est indépendant, testable, et laisse le jeu jouable. Pas de big bang.

### Lot 1 — Poser le garde-fou (½ journée) — **à faire en premier**

Sans filet automatique, tout le reste régresse en trois semaines. Il n'y a **pas d'ESLint** dans le projet ; ne pas en introduire un pour ça : un test Jest suffit et coûte zéro dépendance.

`tests/architecture/boundaries.test.js` — parcourt `src/`, lit les `import`, applique le tableau §3.
On l'écrit avec la **liste actuelle des violations en allowlist**, puis on vide l'allowlist lot par lot. C'est ce qui rend le refactor mesurable : le compteur ne peut que descendre.

```js
// esquisse
const ALLOWED_LEGACY_IMPORTS = new Set([
  'contexts/accounting/domain/policies/LedgerIdempotencePolicy.js',
  'contexts/supply/domain/manufacturing/FactoryStoragePolicy.js',
  // … 15 autres, à retirer au fil des lots
]);
```

### Lot 2 — Couper `domain` → `js/` (D1 + D2 partiel)

1. Déplacer `js/stores/ledgerBusinessKeys.js` → `contexts/accounting/domain/policies/LedgerBusinessKeys.js`. Le legacy y accède via `acl/accounting.js`. Supprime **9 violations d'un coup**.
2. Extraire de `config.js` les seules clés lues par le domaine, vers les catalogues du contexte concerné :
   - `factoryMaxStorage`, `factoryEmployeeNeeds` → `supply/domain/manufacturing/ProductRecipeCatalog.js` (le fichier existe déjà).
   - `budget.*` lu par `GetTreasurySnapshot` → passé en **paramètre du composition root**, pas importé.
   `config.js` reste pour le legacy et le technique (`tickMs`, `citySize`) — on ne le supprime pas.
3. Corriger `JournalFinancialStatementsPolicy.js:4` : les fonctions d'agrégation pures descendent dans `domain/`, l'accès Dexie reste dans l'adapter.

**Après ce lot : `domain/` et `application/` sont propres. C'est le jalon qui compte.**

### Lot 3 — Sortir la présentation du domaine (D5 → règle D4-entrant)

Créer `contexts/accounting/presentation/` (ou `application/view-models/` — au choix, mais **une** convention).
Y déplacer les 4 `*PresentationPolicy.js` + `formatEuroOrNa`. Les ré-exporter depuis `js/acl/accounting.js`, puis réécrire les 12 imports fautifs pour viser l'ACL.

Bénéfice réel : les 12 violations tombent **et** `domain/` ne contient plus que des règles de jeu — le dossier redevient lisible.

### Lot 4 — Dégonfler `accountingGame.js` (D4-sortant)

Ne pas le réécrire. Le découper mécaniquement :
- ce qui est *ré-export* reste dans `acl/accounting.js` ;
- ce qui est *orchestration multi-use-case* remonte en `application/services/` du contexte (c'est là que ça appartient) ;
- `accountingGame.js` ne garde que des adaptations de signature legacy.

Cible réaliste : < 150 lignes.

### Lot 5 — Rapatrier les règles UI dupliquées (D3, quick wins)

Par ordre de rentabilité :

1. **Taux de prêt** → `accounting/domain/policies/LoanRatePolicy.js`. Fonction pure `computeLoanRate({ loanType, financialHealth })`, testée, appelée aux deux endroits de `LoansManager.js`. ~30 lignes, supprime un bug latent.
2. **Seuils d'objectifs** → `ObjectiveCatalog` (une table, pas une classe). Le `5000` n'existe plus qu'une fois.
3. **`BudgetProcessor`** → `accounting/application/services/ProcessTurnBudget.js`.

### Lot 6 — Commerce : à extraire, c'est le fruit le plus mûr

Mesures qui tranchent la question :

| Fichier | LOC | Appels DOM | Accès Dexie |
|---|---:|---:|---:|
| `js/game/services/CommerceService.js` | 804 | **0** | **0** |
| `js/ui/commerce-section.js` | 1 923 | 41 lignes seulement | — |

`CommerceService` ne touche **ni le DOM ni la base**. C'est 804 lignes de règles quasi pures qui ne dépendent que de `commerceStore`. Aucun autre bloc de cette taille dans le projet n'est aussi prêt à sortir : il n'y a pas de démêlage Three.js/DOM à faire, juste un déplacement et une inversion de dépendance.

Et `commerce-section.js`, malgré son nom, n'est qu'à ~2 % du DOM : il héberge du domaine franc — `hasActiveContract`, `getContractStatus`, `checkPartnerActivationConditions`, `checkDefaultActivationConditions`, et surtout `getPriceStatus:1537` avec ses seuils `0.7 / 1.5 / 1.3 / 0.5` codés en dur dans un fichier d'UI.

**Ordre d'extraction :**

1. `contexts/commerce/domain/policies/` ← `getPriceStatus`, `isContractFinished`, `canImportProduct`, `canExportProduct`, `getPartnerTradeLimit`, conditions d'activation des partenaires. Fonctions pures, testables immédiatement.
2. `contexts/commerce/application/` ← `processProductImport` / `processProductExport` en commands, stocks windmill en queries.
3. `commerce-section.js` ne garde que le rendu.

Le port de sortie vers la comptabilité existe déjà (`recordCommerceImportExpense` / `recordCommerceExportIncome`) : le contexte se branche sans rien inventer.

### Hors périmètre (ne pas faire maintenant)

`scene.js` (2 290 LOC), `buttons.js` (2 565 LOC), `camera.js`, `AssetManager.js` : c'est du **rendu et de l'UI**, pas du domaine. Ils sont gros mais à leur place dans l'infrastructure. Les découper est du confort, pas de l'architecture.

---

## 5. Ce qu'on ne fait PAS — YAGNI explicite

Le principal risque de ce refactor n'est pas de sous-faire, c'est de sur-faire. Décisions actées :

| Tentation | Décision | Pourquoi |
|---|---|---|
| Entités/Aggregate Roots riches avec invariants encapsulés | **Non.** On garde `*Snapshot` + policies pures | Les données vivent dans Dexie et l'ECS. Un aggregate en mémoire créerait un troisième état à synchroniser. Les policies pures donnent 90 % du bénéfice (testabilité, langage ubiquitaire) pour 10 % du coût. |
| Bus d'événements domaine généralisé | **Non.** `InMemoryDomainEventPublisher` reste local à Parcels | Un seul contexte en a un besoin démontré. Généraliser rendrait le flux de jeu asynchrone et indébogable. |
| Conteneur DI / décorateurs / TypeScript | **Non** | Les factories `create*Context()` sont explicites et lisibles. JSDoc couvre déjà le typage utile. |
| Migration complète vers l'ECS (`GameLoop` remplace `TimeManager`) | **Non** | Le pipeline ECS actuel sert 6 systèmes et suffit. `TimeManager` fonctionne. |
| Un BC par module legacy (Commerce, Loans, Objectives, Citizens…) | **Non par défaut** | On extrait au cas par cas, sur douleur constatée. Loans et Objectives = quelques policies dans `accounting`, pas des contextes. |
| CQRS avec bus de commandes | **Non** | La séparation commands/queries par dossier est déjà en place et suffit. Un bus n'ajouterait qu'une indirection. |
| Réécrire `src/js/` | **Non** | Le legacy s'érode par les bords (ACL), il ne se remplace pas. |
| Event sourcing sur le journal comptable | **Non**, malgré la tentation | Le journal *est* append-only, mais l'ajout d'une projection formelle ne résoudrait aucun bug actuel. |

---

## 6. Conventions à figer

Elles existent de facto ; les écrire évite la dérive.

- **Nommage** : `Verb + Noun` pour commands (`PlaceBuilding`), `Get/List + Noun` pour queries (`GetCityPopulationSummary`), `Noun + Policy` pour les règles pures, `Noun + Snapshot` pour les DTO de lecture.
- **Ports** : nommés côté domaine (`EmploymentBuildingRepository`), jamais côté techno. Les adapters, eux, portent la techno (`DexieEmploymentBuildingRepository`).
- **Un composition root par contexte**, `getOrCreate*Context()` pour le legacy, `create*Context({ db })` pour les tests.
- **Langue** : langage ubiquitaire en français dans les README, identifiants de code en anglais. C'est la pratique actuelle, elle est cohérente.
- **Tests** : `tests/contexts/<bc>/` en miroir. Le domaine se teste sans mock ; l'application se teste avec des ports en mémoire ; l'infrastructure avec `fake-indexeddb`.

---

## 7. Ordre recommandé et effort

| Lot | Effort | Violations supprimées | Priorité |
|---|---|---:|---|
| 1 — Test d'architecture | ½ j | 0 (mais gèle la dette) | 🔴 |
| 2 — `domain` ⊥ legacy | 1–2 j | 11 | 🔴 |
| 7 — Couper les globals Commerce (D6) | ½ j | 2 canaux implicites | 🔴 |
| 6 — Commerce → contexte | 2–3 j | — (804 LOC déjà purs) | 🟠 |
| 3 — Presentation hors domaine | 1 j | 12 | 🟠 |
| 5 — Règles UI dupliquées | ½ j | — (corrige des bugs) | 🟠 |
| 4 — Dégonfler l'ACL comptable | 1 j | — | 🟡 |

Les lots 1 à 3 (≈ 3 jours) suppriment **23 des 29 violations d'import** et rendent la règle de dépendance vraie.

### Lot 7 — Couper les canaux implicites (D6)

Avant d'extraire Commerce, supprimer les deux canaux qui contourneraient le contexte de toute façon :

1. `CommerceService.js:281` et `:737` : `window.commerceSectionManager.goodsData` → passer `goodsData` en **argument** ou via le composition root.
2. `CommerceStore` (localStorage) comme bus service ↔ UI → dépendance explicite injectée.

Une demi-journée, et elle conditionne la valeur du lot 6.

### Le critère de décision, une bonne fois

Pour trancher « ça va dans un contexte ou ça reste en infrastructure ? », une seule question :

> **Cette règle survit-elle si on remplace Three.js par un autre moteur de rendu ?**

- Oui → c'est du domaine, ça va dans un contexte. (`getPriceStatus`, taux de prêt, seuils d'objectifs, conditions d'activation partenaire.)
- Non → c'est de l'infrastructure, ça reste. (`scene.js`, `camera.js`, `AssetManager.js`, `meshManager.js`, le rendu DOM des sections UI.)

Un projet « 100 % DDD » garde une grosse couche d'infrastructure : ~2 300 lignes de `scene.js` ne sont pas une dette, c'est un moteur de rendu. **L'objectif n'est pas que `src/js/` disparaisse**, c'est qu'il ne contienne plus une seule règle de jeu.
