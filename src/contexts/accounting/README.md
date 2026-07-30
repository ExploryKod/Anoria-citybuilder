# Bounded context : Accounting (Comptabilité)

Phase 0 — spécification et cartographie. **Aucun refactor métier ici** : documenter l’état actuel, la cible, et la dette connue avant toute extraction de code.

## Décisions validées

1. **Journal = source de vérité** des mouvements comptables (append-only, indexé par `turn`) — **à condition d’écritures fiables** (Phase 3½ ; voir D9).
2. **Trésorerie co-maintenue** : cache `budget_current` mis à jour en parallèle du journal pour la perf temps réel ; réconciliable avec le journal.
3. **Trois surfaces comptables distinctes** (ne pas mélanger) :
   - **Journal** (grand livre) — écritures chronologiques, agrégats par mois/année, export ; **source de vérité affichée**.
   - **Livret ville** (style César 3) — revenus / dépenses simples, N vs N-1.
   - **États financiers** (compta classique) — bilan, compte de résultat, règles comptables.
4. Les bugs comptables métier seront traités **après** l’organisation du code (plus facile si les frontières sont claires).

---

## Ubiquitous language

| Terme FR | Terme code (cible) | Définition |
|---|---|---|
| **Journal** | `GeneralLedger` | Grand livre : toutes les écritures (`db.journal`). Source de vérité. |
| **Écriture** | `LedgerEntry` | Mouvement `{ turn, type, amount, description, year?, month?, partnerId? }`. |
| **Trésorerie** | `Treasury` | Solde courant (`budget_current.funds`). Cache co-maintenu, pas dérivé à la lecture temps réel. |
| **Livret ville** | `CityLedger` | Présentation admin César 3 : dépenses/revenus par type, comparaison annuelle. |
| **Compte de résultat** | `IncomeStatement` | Produits / charges / résultat net sur une période (règles comptables). |
| **Bilan** | `BalanceSheet` | Actif / passif à une date (règles comptables + actif immobilisé bâti). |
| **Flux net (exercice)** | `PeriodNetFlow` | Revenus − dépenses sur une période (journal ou agrégat exercice). |
| **Flux net (tour)** | `DailyNetFlow` | `dailyIncome − dailyExpenses` du tour en cours (`budget_current`). |
| **Report à nouveau** | `carry_forward` | Solde N−1 reporté en début d’année N (écriture journal). |
| **Snapshot tour** | `budget_turn_N` | Copie historique de `budget_current` tous les 3 tours — **cache legacy**, pas source de vérité cible. |

### Sens de `netFlow` (ambiguïté actuelle)

| Contexte | Signification aujourd’hui | Source |
|---|---|---|
| `budget_current.netFlow` | Cumul exercice : `income − expenses` | `db.budget` (`budget_current`) |
| `getFinancialHealth().netFlow` | Flux **du tour** : `dailyIncome − dailyExpenses` | `BudgetManager.getFinancialHealth()` |
| Journal `yearData.netFlow` | Flux net **de l’année civile** (hors cumuls/balance) | `JournalManager.getYearlyFinancialSummary()` |

→ À terme : nommer explicitement `periodNetFlow` vs `dailyNetFlow` dans le code.

---

## Architecture cible

### Les 4 surfaces UI (dont 3 comptables)

Presenters dans `src/js/ui/`. Chaque surface appelle l'ACL → **use case** (pas Dexie directement).

| Surface | Panneau | Presenter (UI) | Use case | Rôle |
|---|---|---|---|---|
| **Journal** | `#journal-panel` | `ui/journal/JournalManager.js` | `queries/journal/*` | Grand livre : écritures, mois/années, export |
| **Livret ville** | `#admin-section-finances` | `ui/finances-section.js` | `queries/city-ledger/*` | Tableau César 3 N vs N−1 |
| **Bilan + CR** | `#budget-panel`, `#budget-states-panel` | `buttons.js`, `BudgetStatesManager.js` | `queries/financial-statements/*` | Compta classique (PCG) |
| **Trésorerie live** | `.display-funds`, `#realtime-budget-panel` | HUD, `RealtimeBudgetManager.js` | `queries/treasury/*` | Solde courant + flux du tour |

### Niveau 1 — couches (un BC, domain unifié)

Aligné sur **Quizzam** (`ports/` + `adapters/` + DI au câblage) et **Supply** (use cases groupés en sous-dossiers).  
**Pas** 4 stacks `domain/application/infrastructure` — **un** domain, des use cases, des ports, des adapters.

```
contexts/accounting/
  domain/                          # entités / VO stables + policies (noms, pas verbes)
    value-objects/
      CityLedgerYearLines.js       # VO — colonne annuelle livret César 3
      FinancialStatusMessage.js    # VO — message sous le livret
    read-models/
      CityLedgerComparison.js      # comparaison N / N-1 / N-2
    policies/
      CityLedgerLineMappingPolicy.js
      CityLedgerFinancialStatusPolicy.js
    # à venir :
    #   entities/     LedgerEntry, TreasurySnapshot…
    #   value-objects/ BalanceSheetLine, IncomeStatementLine…
    #   read-models/  BalanceSheet, IncomeStatement…
  application/
    commands/
      journal/                     # RecordLedgerEntry, CreateCarryForwardEntry…
      treasury/                    # ApplyTreasuryMovement, UpdateTreasuryTurn…
    queries/
      journal/                     # GetGeneralLedger, ExportJournal…
      treasury/                    # GetTreasuryBalance, GetFinancialHealth…
      city-ledger/                 # GetCityLedgerYearComparison
      financial-statements/        # GetBalanceSheet, GetIncomeStatement
    ports/                         # interfaces — DIP
      JournalRepository.js
      TreasuryRepository.js
      CityAssetsValuationPort.js
  infrastructure/
    adapters/
      persistence/                 # nos tables — le BC possède la donnée
        dexie/
          DexieJournalRepository.js
          DexieTreasuryRepository.js
      shared/                      # autres modules Anoria (même repo, autre contexte)
        CityAssetsValuationAdapter.js   # → src/shared/city-assets/
      legacy/                      # temporaire Phase 1–2 — wraps stores actuels
        LegacyJournalRepository.js      # → stores/JournalManager
        LegacyTreasuryRepository.js     # → BudgetManager.getCurrentBudget
      fakes/                       # tests — doubles in-memory (Quizzam)
        InMemoryJournalRepository.js
```

### Taxonomie des adapters (3 familles)

Tous sont des **adapters** (implémentent un `port/`). Le sous-dossier indique **la nature de la dépendance**, pas la techno seule.

| Dossier | Nature | Exemple | Accounting possède la donnée ? |
|---|---|---|---|
| **`persistence/dexie/`** | Persistance **propre** au BC | `db.journal`, `db.budget` | ✅ Oui |
| **`shared/`** | Module **interne au projet**, autre contexte | `src/shared/city-assets/` → `db.houses.price` | ❌ Non — consommation via port |
| **`legacy/`** | Code **à migrer** (stores monolithiques) | `JournalManager`, `BudgetManager` | transitoire |
| **`fakes/`** | Doubles de test | in-memory repos | tests uniquement |

Pourquoi **pas** `adapters/city-assets/` à la racine ?

- Ça mélange avec `dexie/` alors que ce n'est **pas** de la persistance Accounting.
- `city-assets` n'est pas un service externe (navigateur, API) — c'est du **cross-context in-repo**.
- `shared/` (ou `cross-context/`) le dit explicitement : « j'appelle un autre module Anoria via son composition root ».

Alternative acceptée si tu préfères le vocabulaire DDD : `adapters/cross-context/city-assets/`. On retient **`shared/`** car le code cible est déjà dans `src/shared/city-assets/`.

**Quizzam** nomme par techno (`adapters/mongo/`) parce que tout est persistance swappable. **Anoria Accounting** a en plus des dépendances **inter-modules** — d'où la split `persistence/` vs `shared/`.

Phase 1 : `legacy/` wrappe les stores existants ; Phase 2 : bascule vers `persistence/dexie/` ; `shared/` dès le bilan (`GetBalanceSheet`).

### Niveau 2 — sous-ensembles métier (organisation des use cases)

`journal`, `treasury`, `city-ledger`, `financial-statements` = sous-dossiers de `commands/` et `queries/` (comme `supply/commands/harvest/`). Ils partagent le **même `domain/`** et les **mêmes `ports/`**.

| Sous-ensemble | Commands | Queries | Domain |
|---|---|---|---|
| **journal** | `RecordLedgerEntry`, `CreateCarryForwardEntry`… | `GetGeneralLedger`, `ExportJournal`… | `LedgerEntry` (à venir), `IncomeExpenseClassificationPolicy` |
| **treasury** | `ApplyTreasuryMovement`, `UpdateTreasuryTurn` | `GetTreasuryBalance`, `GetFinancialHealth` | `TreasurySnapshot` (à venir), `FinancialHealthPolicy` |
| **city-ledger** | — | `GetCityLedgerYearComparison` | `value-objects/CityLedgerYearLines`, `read-models/CityLedgerComparison`, policies |
| **financial-statements** | — | `GetBalanceSheet`, `GetIncomeStatement` | `read-models/BalanceSheet`, `read-models/IncomeStatement` (à venir) |

**Règle domaine :** entités et value objects en **noms** (`CityLedgerYearLines`, `CityLedgerComparison`). Les **verbes** (`Get…`, `Record…`) restent dans `application/`. Les **policies** portent un nom de règle métier ; leurs fonctions expriment une transformation pure (ex. `cityLedgerYearLinesFromJournalSummary`).

Legacy : `stores/JournalManager.js` → `ports/JournalRepository` + `adapters/legacy/LegacyJournalRepository` (Phase 1) puis `adapters/persistence/dexie/` (Phase 2).

### DIP — flux de dépendances

```
Presenter (src/js/ui/**)
        ↓
acl/accounting.js
        ↓
application/queries|commands/**      # use cases → domain + ports
        ↓                    ↓
    domain/policies/     application/ports/*.js
                              ↑
                    infrastructure/adapters/**
```

| Couche | Dépend de | Ne dépend jamais de |
|---|---|---|
| `domain/` | shared kernel | application, infrastructure, UI |
| Use cases | `domain/`, `ports/` | adapters concrets, Dexie |
| `adapters/` | `ports/`, `domain/` | — |
| Presenters / `src/js/**` | `acl/accounting.js` | `domain/` direct |

Use cases **city-ledger** et **financial-statements** consomment journal/trésorerie via **`JournalRepository`** / **`TreasuryRepository`** — pas Dexie, pas entre eux.

### Schéma métier

```
Événements jeu
        ↓
 commands/journal/RecordLedgerEntry  +  commands/treasury/ApplyTreasuryMovement
        ↓
   JournalRepository          TreasuryRepository        (ports)
        ↓                              ↓
   adapters/persistence/dexie/…     adapters/shared/…

 queries/journal/*        ──→ Journal UI
 queries/treasury/*       ──→ HUD + temps réel
 queries/city-ledger/*     ──→ Livret admin
 queries/financial-statements/* → Bilan + CR (+ CityAssetsValuationPort)
```

### Composition et injection (Quizzam / Employment)

`createAccountingContext.js` — seul point de câblage : adapters → use cases.

```javascript
export function createAccountingContext(deps = {}) {
  const journalRepository =
    deps.journalRepository ?? new DexieJournalRepository();
  const treasuryRepository =
    deps.treasuryRepository ?? new DexieTreasuryRepository();
  const cityAssetsValuation =
    deps.cityAssetsValuation ?? new CityAssetsValuationAdapter(); // adapters/shared/

  const getGeneralLedger = new GetGeneralLedger(journalRepository);
  const getCityLedgerYearComparison = new GetCityLedgerYearComparison(
    journalRepository,
    treasuryRepository
  );
  const getBalanceSheet = new GetBalanceSheet(
    journalRepository,
    treasuryRepository,
    cityAssetsValuation
  );

  return {
    getGeneralLedger: (p) => getGeneralLedger.execute(p),
    getCityLedgerYearComparison: (p) => getCityLedgerYearComparison.execute(p),
    getBalanceSheet: (p) => getBalanceSheet.execute(p),
  };
}
```

Tests : `adapters/fakes/` injectés — pas de Dexie.

Code : **anglais**. Libellés UI : **français**.

---

## Inventaire des types d’écriture (`LedgerEntry.type`)

### Écritures opérationnelles (impact trésorerie + agrégats)

| Type | Sens comptable | Revenu / Charge | Écrit par |
|---|---|---|---|
| `capital_funds` | Capital de départ | Revenu | `BudgetManager.initialize()` |
| `citizen_tax` | Impôt citoyen | Revenu | `BudgetManager.addTaxes()`, `addIncome()` |
| `payroll_tax` | Impôt sur les salaires | Revenu | `BudgetManager.addSalaryTax()` |
| `loan_capital` | Tirage de prêt | Revenu | `BudgetManager.addLoan()` |
| `export_{productId}` | Export commerce | Revenu | `BudgetManager.recordExport()` |
| `construction` | Dépense construction | Charge | `BudgetManager.addConstructionExpense()` |
| `maintenance` | Maintenance mensuelle | Charge | `BudgetManager.addBuildingMaintenance()` |
| `salary` | Salaires fonctionnaires | Charge | `BudgetManager.addSalaries()` |
| `loan_interest` | Intérêts de prêt | Charge | `BudgetManager.addLoanInterest()` |
| `loan_repayment` | Remboursement capital | Charge | `BudgetManager.addLoanRepayment()` |
| `import_{productId}` | Import commerce | Charge | `BudgetManager.recordImport()` |
| `exceptional_expenses` | Réparation (événement) | Charge | `RandomEventsService` |
| `commercial_route` | Commission négociants | Charge | `commerce-section.js` |
| `carry_forward` | Report à nouveau | Revenu ou charge (signe) | `JournalManager.createCarryForwardEntry()` |

Produits dynamiques connus : `wheat`, `carrot`, `cabbage`, `wood` → préfixes `import_` / `export_`.

### Écritures informatives (exclues des agrégats revenus/dépenses)

| Type | Rôle |
|---|---|
| `balance` | Snapshot trésorerie par tour (`budget.funds`) — informatif |
| `cumul_maintenance` | Total annuel maintenance (fin d’année) |
| `cumul_construction` | Total annuel construction |
| `cumul_salary` | Total annuel salaires |
| `cumul_exceptional_expenses` | Total annuel réparations |
| `cumul_loan_interest` | Total annuel intérêts |
| `cumul_loan_repayment` | Total annuel remboursements |

### Cache hors Dexie

| Clé | Rôle | Risque |
|---|---|---|
| `localStorage.journal_year_end_balances` | Solde fin d’année pour `carry_forward` | 3ᵉ source si désync journal |

---

## Cartographie UI → query cible → source actuelle

| Surface UI | Panneau HTML | Fichier UI | Query cible (BC) | Source actuelle | Écart |
|---|---|---|---|---|---|
| **Livret ville** (admin César 3) | `#admin-section-finances` | `ui/finances-section.js` | `GetCityLedgerYearComparison` | `DexieJournalRepository` + `DexieTreasuryRepository` | Trésorerie ≠ journal pour balance N |
| **Bilan** (compta classique) | `#budget-panel` | `ui/buttons.js` → `updateBudgetDisplay()` | `GetBalanceSheet(asOfTurn)` | `budget_current` + **City Assets** + prêts actifs + ajustement manuel actif=passif | Pas dérivé du journal ; mélange avec refresh temps réel |
| **Compte de résultat** | `#budget-states-panel` | `ui/budget/BudgetStatesManager.js` | `GetIncomeStatement(period)` | **`getBudgetStates()`** → snapshots `budget_turn_*` | 2ᵉ source ; pas le journal |
| **Journal** (grand livre) | `#journal-panel` | `ui/journal/JournalManager.js` | `GetGeneralLedger(filters)` | `DexieJournalRepository` | Export JSON/PDF encore legacy |
| **Budget temps réel** | `#realtime-budget-panel` | `ui/budget/RealtimeBudgetManager.js` | `GetPeriodCashFlow(currentTurn)` | `budget_current` + `getFinancialHealth()` (**daily** netFlow) | Flux tour ≠ flux exercice |
| **Info-box fonds** | `#display-funds` | (HUD) | `GetTreasuryBalance()` | `budget_current.funds` | ✅ Cohérent avec tréso co-maintenue |
| **Conseil urbain** | — | `ui/urban-advice/UrbanAdviceManager.js` | `GetFinancialHealth()` | `BudgetManager.getFinancialHealth()` | daily netFlow |
| **Prêts** | — | `ui/loans/LoansManager.js` | — | refresh `updateBudgetDisplay()` | Couplage bilan |

---

## État du code legacy (aujourd’hui)

### Fichiers et responsabilités

| Fichier | Rôle actuel | Problème |
|---|---|---|
| `stores/BudgetManager.js` (~1356 L) | God object : écritures, trésorerie, snapshots, santé financière, prêts, délégation journal | Mélange write + read models + règles présentation |
| `stores/JournalManager.js` | Persistance `db.journal`, agrégats, export | ✅ → `ports/JournalRepository` + `adapters/legacy/` puis `persistence/dexie/` |
| `ui/finances-section.js` | Livret César 3 | Logique métier dans UI ; mix journal + tréso |
| `ui/buttons.js` (`updateBudgetDisplay`) | Bilan compta FR (~260 L) | Pas de module dédié ; appelle aussi temps réel |
| `ui/budget/BudgetStatesManager.js` | CR historique | Lit snapshots, pas journal |
| `ui/budget/RealtimeBudgetManager.js` | Flux tour courant | Lit `budget_current` uniquement |
| `ui/journal/JournalManager.js` | Présentation journal | ✅ ACL + query BC (Phase 2b) ; export legacy |
| `game/managers/BudgetProcessor.js` | Tick : taxes, salaires, maintenance, **saveBudgetState** /3 tours | Orchestration legacy |
| `acl/budget.js` | Façade valuation + construction expense | Point d’entrée partiel vers futur BC |

### Persistance Dexie (`db.budget`, `db.journal`)

```
db.journal          ← écritures (PK auto ++id)
db.budget
  ├── budget_current   ← trésorerie + agrégats courants (PK name)
  └── budget_turn_N    ← snapshots historiques (PK name)
```

### Chemin d’écriture (mostly OK)

Toute dépense/revenu significatif passe par `BudgetManager` → `addJournalEntry()` + mise à jour `budget_current`. Exceptions mineures : écritures pures journal (`balance`, `cumul_*`, `carry_forward`) créées par `JournalManager` / `updateTurn()`.

---

## Dette connue (hors refactor — à traiter ensuite)

| # | Sujet | Détail |
|---|---|---|
| D1 | CR sur snapshots | `BudgetStatesManager` lit `budget_turn_*` au lieu du journal |
| D2 | Bilan non journal-based | Actif immobilisé via City Assets OK ; passif / résultat via `budget_current` |
| D3 | Ajustement bilan | Si actif ≠ passif, le résultat net est **forcé** (`buttons.js` L297–307) |
| D4 | `netFlow` polymorphe | Même nom, 3 sens (voir tableau ci-dessus) |
| D5 | `localStorage` report à nouveau | Cache intermédiaire pour `carry_forward` |
| D6 | `addIncome()` | Écrit toujours `citizen_tax` même pour remboursements construction |
| D7 | Bilan incomplet | Amortissements, stocks, créances = 0 ; nombreuses lignes PCG vides |
| D8 | Couplage UI | `updateBudgetDisplay()` déclenche `updateRealtimeBudget()` |
| D9 | Doublons journal salaires / impôts | Écritures multiples même `turn`, libellés mois croisés (vitesse jeu) — **bloque Phase 3** (journal SoT unique) ; voir [`docs/refactor.md`](docs/refactor.md) |

---

## Phases de refactor proposées

### Phase 0 — Spec (ce document) ✅

Cartographie, ubiquitous language, invariants, dette connue.

### Phase 1 — Structure + queries + ACL ✅ (en cours de validation jeu)

Créer l'arborescence unifiée (`domain/`, `application/`, `infrastructure/adapters/`) et extraire :

- `application/queries/city-ledger/GetCityLedgerYearComparison.js`
- `application/queries/treasury/GetTreasuryBalance.js`
- `application/ports/JournalRepository.js`, `TreasuryRepository.js`, `GameTimePort.js`
- `adapters/legacy/` — wrap `JournalManager` / `BudgetManager` / `TimeManager`
- `acl/accounting.js` + `createAccountingContext.js` (DI)
- `finances-section.js` → `getCityLedgerYearComparison()` via ACL

Legacy stores **inchangés** derrière les adapters. **Zéro changement de formules.**

#### Surface de test en jeu (Phase 1)

**Panneau à valider : Admin → Finances** (`#admin-section-finances`)

Chemin : bouton **Administrateur** (HUD) → icône **pièces** (`#admin-nav-finances`) → section Finances.

C’est le **livret ville César 3** — seul panneau migré en Phase 1. Vérifications manuelles :

1. **Balance « cette année »** = montant HUD `.display-funds` (trésorerie co-maintenue).
2. **Lignes revenus/dépenses** (impôts, construction, maintenance, salaires…) = cohérentes avec le **Journal** (`#journal-panel`) pour les mêmes types.
3. **Colonnes N / N-1** : après quelques tours (taxes novembre, maintenance mensuelle), les totaux bougent comme avant le refactor.

**Panneaux hors Phase 1** (inchangés, ne servent pas à valider cette phase) :

| Panneau | Bouton | Pourquoi pas Phase 1 |
|---|---|---|
| Bilan | `#budget-panel` | Toujours sur `budget_current` + City Assets |
| Compte de résultat | `#budget-states-panel` | Toujours sur snapshots `budget_turn_*` |
| Budget temps réel | `#realtime-budget-panel` | Pas encore branché sur `acl/accounting` |
| Journal | `#journal-panel` | Déjà isolé ; sert de **référence croisée**, pas de migration |

### Phase 2a — Persistence Dexie (BC-owned read path) ✅

- `adapters/persistence/dexie/DexieJournalRepository.js` — lecture `db.journal` via ports
- `adapters/persistence/dexie/DexieTreasuryRepository.js` — lecture `budget_current.funds`
- `journalAggregations.js` — agrégats partagés (JournalManager + Dexie repo, zéro duplication)
- `createAccountingContext` bascule sur Dexie par défaut ; `createLegacyAccountingContext()` pour tests legacy
- Écritures : toujours `BudgetManager` / `JournalManager` (Phase 4 commands)

### Phase 2b — Journal UI + presenters ✅

- `application/queries/journal/GetGeneralLedger.js` + `assembleGeneralLedgerView.js`
- `domain/read-models/GeneralLedgerView.js`
- `domain/policies/GeneralLedgerPresentationPolicy.js` (filtres type)
- `acl/accounting.js` → `getGeneralLedger(filters)`
- `ui/journal/JournalManager.js` — presenter DOM ; plus d'accès store pour la lecture
- Export JSON/PDF : legacy store (Phase 3+)
- Voir [`docs/refactor.md`](docs/refactor.md) — J1/J2 corrigés sur le nouveau chemin

### Phase 2c — Calculs nets livret

- Extraire calculs nets restants hors `finances-section.js`
- Presenters branchés sur `acl/accounting` uniquement

### Phase 3½ — Write path fiable (**bloquant avant Phase 3**)

Journal non fiable comme SoT unique tant que D9 (doublons write legacy). Voir gate dans [`docs/refactor.md`](docs/refactor.md).

- `commands/journal/RecordLedgerEntry` + `commands/treasury/ApplyTreasuryMovement`
- Idempotence salaires / impôts / maintenance
- Tests réconciliation trésorerie ↔ journal

### Phase 3 — Unifier les lectures sur le journal (**après 3½**)

- `queries/financial-statements/GetIncomeStatement` via `JournalRepository`
- `GetBalanceSheet` : ports journal + trésorerie + City Assets
- Snapshots `budget_turn_*` : cache dérivé ou suppression

### Phase 4 — Extinction write legacy

- Réduction progressive de `BudgetManager` (plus d’écriture directe journal)

---

## Invariants cibles

1. **Une écriture opérationnelle = une ligne journal + mise à jour trésorerie** (transaction logique).
2. **Aucune UI ne lit `budget_turn_*` comme source primaire** (après Phase 3).
3. **Use cases** (`city-ledger`, `financial-statements`) consomment journal/trésorerie **via ports** — jamais Dexie, jamais entre eux directement.
4. **`balance` et `cumul_*` ne participent pas aux totaux revenus/charges** (déjà le cas dans `JournalManager`).
5. **Réconciliation** : `treasury.funds` ≈ `journal.getCurrentBalance()` (tolérance arrondi) — testable.

---

## Relations (context map)

| Contexte | Relation | Détail |
|---|---|---|
| **City Assets** | Supplier | Valorisation actif immobilisé (bilan) |
| **Construction** | Customer | `recordConstructionExpense` via `acl/budget.js` |
| **Commerce** | Customer | import/export → journal |
| **Employment** | Customer | salaires / impôt payroll |
| **Housing** | Customer | population pour taxes / salaires |
| **Legacy game** | ACL | `BudgetProcessor`, `BudgetManager` global |

Façade actuelle : `src/js/acl/budget.js` (valuation + construction)  
Façade cible : `src/js/acl/accounting.js`  
Composition : `createAccountingContext.js` (DI — adapters → use cases, pattern Quizzam/Employment)

Règle : `src/js/**` n'importe **pas** `contexts/accounting/**/domain/**` directement (identique Employment).

---

## Tests existants

| Fichier | Couvre |
|---|---|
| `tests/JournalManager.test.js` | Persistance, agrégats journal |
| `tests/BudgetManager.test.js` | Trésorerie, délégation journal |
| `tests/acl/budgetBuildingValuation.test.js` | Valorisation bâti |

Tests cibles Phase 1+ :

- `getCityLedgerYearComparison.behavior.test.js` — mapping types → lignes livret
- `getGeneralLedger.behavior.test.js` — filtres type/période, totaux cohérents
- `incomeStatementFromJournal.behavior.test.js` — CR depuis journal
- `treasuryReconciliation.behavior.test.js` — funds vs balance journal

---

## Hors scope (pour l’instant)

- BC Commerce comptable complet
- Correction des bugs D1–D8 (documentés, traités après organisation)
- FarmParcelPolicy, refactors Parcels/Housing/Supply en cours ailleurs
