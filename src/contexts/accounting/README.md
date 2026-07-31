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
| **Écriture** | `LedgerEntry` | Mouvement `{ turn, type, amount, description, year?, month?, partnerId?, businessKey? }`. |
| **Clé métier** | `businessKey` | Identifiant logique d’une opération récurrente (ex. `maintenance:0:5`) — garantit **au plus une** écriture par période pour certains types. |
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
      JournalWritePort.js          # append session buffer (Phase 3½)
      TreasuryRepository.js
      TreasuryWritePort.js         # débits/credits budget_current (Phase 3½)
      CityAssetsValuationPort.js
  infrastructure/
    adapters/
      persistence/                 # nos tables — le BC possède la donnée
        dexie/
          DexieJournalRepository.js
          DexieTreasuryRepository.js
        session/
          SessionJournalRepository.js   # lecture buffer
          SessionJournalWriteAdapter.js # écriture buffer
      shared/                      # autres modules Anoria (même repo, autre contexte)
        CityAssetsValuationAdapter.js   # → src/shared/city-assets/
      legacy/                      # temporaire Phase 1–2 — wraps stores actuels
        LegacyJournalRepository.js      # → stores/JournalManager
        LegacyTreasuryRepository.js     # → BudgetManager.getCurrentBudget
        LegacyTreasuryWriteAdapter.js   # → BudgetManager.db.budget (Phase 3½)
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
| **journal** | `RecordLedgerEntry`, `CreateCarryForwardEntry`… | `GetGeneralLedger`, `ExportJournal`… | `LedgerEntry` (à venir), `LedgerIdempotencePolicy`, `IncomeExpenseClassificationPolicy` |
| **treasury** | `ApplyTreasuryMovement`, `UpdateTreasuryTurn` | `GetTreasuryBalance`, `GetFinancialHealth` | `TreasurySnapshot` (à venir), `FinancialHealthPolicy` |
| **services** | `RecordMaintenanceExpense` (orchestration journal + trésorerie) | — | — |
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
        ↓                                    ↓
   JournalWritePort                    TreasuryWritePort
        ↓                                    ↓
   SessionJournalWriteAdapter         LegacyTreasuryWriteAdapter
        ↓                                    ↓
   SessionLedgerBuffer (RAM)           budget_current (Dexie)

 queries/journal/*        ──→ Journal UI
 queries/treasury/*       ──→ HUD + temps réel
 queries/city-ledger/*     ──→ Livret admin
 queries/financial-statements/* → Bilan + CR (+ CityAssetsValuationPort)
```

---

## RecordLedgerEntry et idempotence (`businessKey`)

### Objectif

**Idempotent** ici = rappeler plusieurs fois la même opération métier **ne produit qu’une seule écriture** (et, via les services orchestrateurs, **un seul mouvement de trésorerie**).

Cela protège contre les doubles ticks (vitesse 2×), les races async, ou un orchestrateur legacy appelé deux fois dans le même mois civil.

### Mécanisme

1. **`RecordLedgerEntry`** (`application/commands/journal/RecordLedgerEntry.js`) reçoit `{ turn, type, amount, description, … }`.
2. Elle dérive une **`businessKey`** via `LedgerIdempotencePolicy` → `buildLedgerBusinessKey(type, timeInfo)` (source : `js/stores/ledgerBusinessKeys.js`).
3. **Avant d’écrire**, elle interroge `JournalWritePort.hasBusinessKey(key)` sur le buffer session.
4. Si la clé existe déjà → `{ recorded: false, skipped: true, reason: 'duplicate_business_key' }` — **aucune nouvelle ligne**.
5. Sinon → append dans `SessionLedgerBuffer` avec la clé persistée sur la row.

Les services métier (ex. **`RecordMaintenanceExpense`**) n’appliquent la trésorerie **que si** `recorded === true` — un skip journal implique skip trésorerie.

### Clés par type (aujourd’hui)

| Type | `businessKey` | Règle |
|---|---|---|
| `maintenance` | `maintenance:{year}:{monthIndex}` | Au plus **1× par mois civil** |
| `salary` | `salary:{year}:{monthIndex}` | Au plus **1× par mois civil** |
| `payroll_tax` | `payroll_tax:{year}:{monthIndex}` | Au plus **1× par mois civil** |
| `citizen_tax` | `citizen_tax:{year}` | Au plus **1× par année civile** |
| `loan_capital` | `loan_capital:{loanId}` | Au plus **1× par contrat** |
| `loan_interest` | `loan_interest:{loanId}:{turn}` | Au plus **1× par prêt et par tour** |
| `loan_repayment` | `loan_repayment:{loanId}:{turn}` | Au plus **1× par prêt et par tour** |
| `capital_funds` | `capital_funds:0` | Au plus **1× par partie** (journal ; trésorerie déjà initialisée) |
| `commercial_route` | `commercial_route:{partnerId}` | Au plus **1× par partenaire** |
| `construction`, imports, exports, exceptional… | `null` | **Pas idempotent** — chaque événement = une ligne distincte |

Exemple : maintenance de juin année 0 → `maintenance:0:5`. Un 2ᵉ appel au tour 31 (toujours juin) est ignoré ; au tour suivant en juillet → nouvelle clé `maintenance:0:6`.

### Périmètre et limites

- L’idempotence porte sur le **buffer session** (autoritaire en jeu) ; au chargement, `inferBusinessKeyFromRow()` reconstitue les clés des lignes IndexedDB legacy.
- Ce n’est **pas** une idempotence HTTP générique (pas de `Idempotency-Key` arbitraire) : c’est une **règle métier par type + période calendaire**.
- Les gardes legacy (`BudgetProcessor.lastMaintenanceMonth`, etc.) restent en place ; `businessKey` est la **ceinture de sécurité** au niveau journal.

### Slice livrée (Phase 3½ — maintenance + construction + paie + impôt citoyen)

| Élément | Maintenance | Construction | Salaires | Impôt paie | Impôt citoyen |
|---|---|---|---|---|---|
| Orchestrateur | `RecordMaintenanceExpense` | `RecordConstructionExpense` | `RecordSalaryExpense` | `RecordPayrollTaxIncome` | `RecordCitizenTaxIncome` |
| Idempotence | Oui (mensuel) | Non | Oui (mensuel) | Oui (mensuel) | Oui (`citizen_tax:{année}`) |
| Call site migré | `addBuildingMaintenance()` | `addConstructionExpense()` | `addSalaries()` | `addSalaryTax()` | `addTaxes()` |
| Trésorerie | `expenses` + maintenance | investissements / dépenses | `expenses` + salaires | `income` | `income` + `totalTaxes` + `lastTaxYear` |
| Id bâtiment | — | `buildingInstanceId` | — | — | — |

Fichiers communs : `RecordLedgerEntry`, `ApplyTreasuryMovement`, adapters write, `createAccountingContext`, tests `recordLedgerEntry.behavior.test.js`.

**Prochaines slices write :** réconciliation trésorerie ↔ journal (global), types restants (`exceptional_expenses`, `commercial_route`, `capital_funds`…).

### Commerce (Phase 3½)

| Type | Orchestrateur | Call site | Idempotence | Trésorerie |
|---|---|---|---|---|
| `import_{productId}` | `RecordCommerceImportExpense` | `addImportExpense()` | Non — 1 ligne par transaction | débit `expenses` + `totalImports[productId]` |
| `export_{productId}` | `RecordCommerceExportIncome` | `addExportIncome()` | Non — 1 ligne par transaction | crédit `income` + `totalExports[productId]` |

`partnerId` (ville négociante) est persisté sur la ligne journal quand fourni par `CommerceService`.

### Prêts (Phase 3½)

| Type | Orchestrateur | Call site | Idempotence | Trésorerie |
|---|---|---|---|---|
| `loan_capital` | `RecordLoanCapitalIncome` | `addLoan()` | `loan_capital:{loanId}` | crédit `income` |
| `loan_interest` | `RecordLoanInterestExpense` | `addLoanInterest()` | `loan_interest:{loanId}:{turn}` | débit `expenses` + cumuls intérêts |
| `loan_repayment` | `RecordLoanRepaymentExpense` | `repayLoan()` | `loan_repayment:{loanId}:{turn}` | débit `expenses` + `totalLoanRepayments` |

Le portefeuille prêts (`budget.loans`, `loanDebt`, `calculateLoanTotals`) reste dans `BudgetManager` après l’écriture BC. Les clés d’échéance s’appuient sur le **tour de jeu**, pas le mois civil — voir [`docs/refactor.md`](docs/refactor.md) (dette J8).

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
| `capital_funds` | Capital de départ | Revenu | `BudgetManager.initialize()` → **`RecordCapitalFundsIncome`** (journal ; `funds` + `income` pré-amorcés) |
| `citizen_tax` | Impôt citoyen | Revenu | `BudgetManager.addTaxes()` → **`RecordCitizenTaxIncome`** (Phase 3½) |
| `construction_refund` | Remboursement placement | Contre-investissement | `BudgetManager.addConstructionRefund()` → **`RecordConstructionRefundIncome`** (Phase 4) |
| `payroll_tax` | Impôt sur les salaires | Revenu | `BudgetManager.addSalaryTax()` → **`RecordPayrollTaxIncome`** (Phase 3½) |
| `loan_capital` | Tirage de prêt | Revenu | `BudgetManager.addLoan()` → **`RecordLoanCapitalIncome`** (Phase 3½) |
| `export_{productId}` | Export commerce | Revenu | `BudgetManager.addExportIncome()` → **`RecordCommerceExportIncome`** (Phase 3½) |
| `construction` | Dépense construction | Charge | `BudgetManager.addConstructionExpense()` → **`RecordConstructionExpense`** (Phase 3½) |
| `maintenance` | Maintenance mensuelle | Charge | `BudgetManager.addBuildingMaintenance()` → **`RecordMaintenanceExpense`** (Phase 3½) |
| `salary` | Salaires fonctionnaires | Charge | `BudgetManager.addSalaries()` → **`RecordSalaryExpense`** (Phase 3½) |
| `loan_interest` | Intérêts de prêt | Charge | `BudgetManager.addLoanInterest()` → **`RecordLoanInterestExpense`** (Phase 3½) |
| `loan_repayment` | Remboursement capital | Charge | `BudgetManager.repayLoan()` → **`RecordLoanRepaymentExpense`** (Phase 3½) |
| `info_loan_interest` | Intérêts impayés (informatif) | Informatif — pas de trésorerie | `BudgetManager.recordInfoLoanInstallment()` → **`RecordInfoLoanInstallment`** |
| `info_loan_repayment` | Capital impayé (informatif) | Informatif — pas de trésorerie | idem — clé `info:loan_*:{loanId}:{turn}`, description `[Informatif] …` |
| `import_{productId}` | Import commerce | Charge | `BudgetManager.addImportExpense()` → **`RecordCommerceImportExpense`** (Phase 3½) |
| `exceptional_expenses` | Réparation (événement) | Charge | `BudgetManager.addExceptionalExpense()` → **`RecordExceptionalExpense`** (Phase 3½) |
| `commercial_route` | Commission négociants | Charge | `BudgetManager.addCommercialRouteFee()` → **`RecordCommercialRouteExpense`** (Phase 3½) |
| `carry_forward` | Report à nouveau | Revenu ou charge (signe) | **`SyncTurnInformativeEntries`** → `RecordCarryForwardEntry` (Phase 4 slice 6) |
| `balance` | Snapshot trésorerie / tour | Informatif (session) | **`SyncTurnInformativeEntries`** → `RecordBalanceSnapshot` |
| `cumul_*` | Totaux annuels | Informatif | **`SyncTurnInformativeEntries`** → `RecordYearCumulEntries` |

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

**Pseudo-mouvements** (échéance théorique, **sans** débit/crédit trésorerie) — voir `domain/policies/LedgerInformativeTypePolicy.js` :

| Élément | Convention | Exemple |
|---|---|---|
| `type` | `info_{sourceType}` | `info_loan_interest` |
| `businessKey` | `info:{sourceType}:{entityId}:{turn}` | `info:loan_interest:loan_abc:12` |
| Libellé journal | « informatif » explicite | `Intérêts prêt (informatif — impayé)` |
| `description` | préfixe `[Informatif]` | `[Informatif] Intérêts prêt — impayés, …` |

Types legacy `loan_default_*` restent lisibles à l’export (alias UI).

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

### Chemin d’écriture

**Maintenance (Phase 3½ — migré) :**

```
BudgetProcessor.processBudget()
  → BudgetManager.addBuildingMaintenance(amount, description)
    → recordMaintenanceExpense() → RecordLedgerEntry + ApplyTreasuryMovement
```

**Construction (Phase 3½ — migré) :**

```
PlaceBuildingWithPayment.execute()
  → BudgetManager.addConstructionExpense(amount, reason)
    → recordConstructionExpense() → RecordLedgerEntry + ApplyTreasuryMovement
```

**Autres types (legacy) :** dépense/revenu via `BudgetManager` → `addJournalEntry()` + mise à jour `budget_current`. Exceptions : écritures pures journal (`balance`, `cumul_*`, `carry_forward`) créées par `JournalManager` / `updateTurn()`.

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
| D9 | Doublons journal salaires / impôts | `businessKey` + `RecordLedgerEntry` en place ; **maintenance migrée** ; salaires/impôts encore legacy write — voir [`docs/refactor.md`](docs/refactor.md) |

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

### Phase 3½ — Write path fiable (**en cours** — bloquant avant Phase 3)

Journal non fiable comme SoT unique tant que tous les types opérationnels ne passent pas par les commands BC. Voir gate dans [`docs/refactor.md`](docs/refactor.md).

#### Slice 1 ✅ — Buffer session + flush batch

- `SessionLedgerBuffer`, `SessionJournalRepository`, flush fin de tour

#### Slice 2 ✅ — `RecordLedgerEntry` + charges récurrentes + impôt citoyen + prêts

- Services : maintenance, construction, salaires, impôt paie, impôt citoyen, prêts (capital / intérêts / remboursement)
- Idempotence `businessKey` : maintenance, salary, payroll_tax, citizen_tax
- Tests : `recordLedgerEntry.behavior.test.js`

#### Slice 3 ✅ — Commerce imports / exports

- `RecordCommerceImportExpense`, `RecordCommerceExportIncome`
- Types journal dynamiques `import_{productId}` / `export_{productId}`, `partnerId` optionnel
- Tests : `recordLedgerEntry.behavior.test.js`, `BudgetManager.test.js`

#### Slice 4 ✅ — Capital, réparations, route commerciale

- `RecordCapitalFundsIncome` (journal only), `RecordExceptionalExpense`, `RecordCommercialRouteExpense`
- Dette legacy documentée : [`docs/refactor.md`](docs/refactor.md) § « Dette legacy restante »

#### Slice 5 ✅ — Dettes legacy write path (D6–D13)

- `RecordConstructionRefundIncome` (`construction_refund`) — remplace `addIncome()` pour remboursements construction
- `addIncome()` / `addDailyExpense()` supprimés (throw / dead code)
- D8 : `initialize()` amorce `income` = capital social (aligné journal `capital_funds`)
- D10–D11 : `config.budget.commercialRouteFee` + retour `{ skipped }` sur activation partenaire
- D12–D13 : ancien `initLoanSystem` supprimé ; `processLoanPayments` uniquement via `BudgetProcessor`

#### Slice 6 ✅ — Réconciliation & informatif

- D14 : `RecordBalanceSnapshot`, `RecordYearCumulEntries`, `RecordCarryForwardEntry`, orchestrateur `SyncTurnInformativeEntries`
- `GetTreasuryJournalReconciliation` + ACL `getTreasuryJournalReconciliation()`
- `BudgetManager.updateTurn()` délègue au BC (plus d'appels directs `JournalManager` pour balance/cumul/carry)
- Tests : `treasuryReconciliation.behavior.test.js`

#### Slice 7 🔲 — États financiers unifiés

- `GetIncomeStatement` / `GetBalanceSheet` depuis journal + trésorerie + City Assets
- Lien livret ↔ CR ↔ bilan (réconciliation multi-surfaces)

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
6. **Idempotence périodique** : pour les types à `businessKey`, un 2ᵉ appel dans la même période civile ne crée ni ligne journal ni mouvement trésorerie.

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
| `tests/contexts/accounting/getCityLedgerYearComparison.behavior.test.js` | Mapping types → lignes livret |
| `tests/contexts/accounting/getGeneralLedger.behavior.test.js` | Filtres journal, totaux cohérents |
| `tests/contexts/accounting/recordLedgerEntry.behavior.test.js` | `RecordLedgerEntry` + maintenance idempotente + délégation BudgetManager |
| `tests/ledgerBusinessKeys.test.js` | Génération / inférence `businessKey` |

Tests cibles (Phase 3+) :

- `incomeStatementFromJournal.behavior.test.js` — CR depuis journal
| `tests/contexts/accounting/treasuryReconciliation.behavior.test.js` | Réconciliation funds vs balance journal + informative BC |

---

## Hors scope (pour l’instant)

- BC Commerce comptable complet
- Correction des bugs D1–D8 (documentés, traités après organisation)
- FarmParcelPolicy, refactors Parcels/Housing/Supply en cours ailleurs
