# Source de vérité — Données financières (2026-07)

## Chaîne comptable PCG (vision cible)

Référence : [Journal → Grand livre → Balance → CR + Bilan](https://finref.fr/comptabilite/generale/journal-grand-livre-balance/)

| Document | Anoria | Rôle |
|---|---|---|
| **Journal** | ✅ `db.journal` / exports `docs/ledgers/` | Mouvements chronologiques (logique journal comptable, regroupés mois/année en UI) |
| **Grand livre** | ❌ absent | Écritures par **compte PCG** (512, 641, 701…) |
| **Balance** | ❌ absent | Soldes par compte, contrôle débit = crédit |
| **Compte de résultat** | 🟡 `IncomeStatement` | Activité **annuelle** (produits − charges) |
| **Bilan** | 🟡 `BalanceSheet` | Patrimoine **annuel** ; résultat net CR au passif |
| **Livret ville** | ✅ `GetCityLedgerYearComparison` | Vue **simplifiée** César 3 pour non-comptables |

Le code `GetGeneralLedger` affiche le **journal**, pas le grand livre — dette de nommage à corriger.

---

## Architecture journal-primary (CR + bilan — raccourci actuel)

Le bounded context **Accounting** expose des états financiers **liés** via `FinancialStatementsBundle` :

```
acl/accounting.js
  getFinancialStatementsAtTurn(turn)   → { incomeStatement, balanceSheet, enrichment }
  getFinancialStatementsHistory({ everyNTurns: 3 })
  getIncomeStatement({ fiscalYear })     → CR annuel civil
  getBalanceSheet()                      → bilan au tour courant (netResult = CR)
```

**Invariant comptable** : `balanceSheet.liabilities.netResult === incomeStatement.netResult`

L'écart actif immobilisé (valorisation City Assets) vs passif hors CR est porté par `liabilities.equityReconciliation` — le résultat net n'est **jamais** forcé pour équilibrer.

---

## Sources par donnée

| Donnée | Source primaire | Cache `db.budget` |
|---|---|---|
| Produits / charges CR (cumul) | Journal opérationnel `turn <= T` | ❌ jamais pour totaux CR |
| Trésorerie au tour T | Entrée journal `balance`, sinon `enrichment.funds` | `budget_turn_*`.funds (fallback) |
| Résultat net bilan | = CR.netResult | ❌ |
| Capital social | Journal `capital_funds` turn 0 | — |
| Actif immobilisé bâti | City Assets (valorisation **courante**) | — |
| Dette prêts au tour T | Prêts actifs (tour courant) ou `enrichment.loanDebt` / estimation journal | `budget_turn_*`.loanDebt |
| Population, taxBreakdown, maintenanceBreakdown | ❌ absent journal | ✅ `budget_turn_*` |
| Trésorerie live (HUD, write path) | Co-maintenue journal + trésorerie | ✅ `budget_current` (**ne pas supprimer**) |

---

## `db.budget` — rôles conservés

```
db.budget
  ├── budget_current   ← trésorerie live + agrégats courants (write path BC)
  └── budget_turn_N    ← cache enrichissement UI (population, breakdowns, loanDebt snapshot)
                         ← écrit par BudgetProcessor.saveBudgetState() tous les 3 tours
                         ← lu par BudgetTurnEnrichmentRepository (read-only, pas source CR)
```

**Ne pas supprimer** `db.budget` sans audit complet des dépendances :
- `DexieTreasuryRepository` / `budget_current`
- `BudgetProcessor.saveBudgetState` (snapshots enrichissement)
- `BudgetManager.getBudgetStates()` (legacy, autres consommateurs possibles)
- Réconciliation trésorerie ↔ journal

---

## UI migrée

| Surface | Fichier | Query BC |
|---|---|---|
| CR historique par tour | `ui/budget/BudgetStatesManager.js` | `getFinancialStatementsHistory()` |
| Bilan panneau budget | `ui/buttons.js` | `getBalanceSheet()` → bundle lié |
| Journal (UI chronologique) | `ui/journal/JournalManager.js` | `getGeneralLedger()` ⚠️ = journal, pas grand livre PCG |
| Livret César 3 | `ui/finances-section.js` | `getCityLedgerYearComparison()` |

---

## Flux de données

```
db.journal (mouvements) ──► JournalFinancialStatementsPolicy
                                │
                                ├─► IncomeStatement (CR cumul)
                                └─► BalanceSheet (lié CR + equityReconciliation)

db.budget budget_turn_* ──► BudgetTurnEnrichmentRepository (enrichissement UI only)

db.budget budget_current ──► DexieTreasuryRepository (trésorerie live, write path)
```

---

## Implications « journal seulement » pour le CR

1. **Totaux CR** = somme des écritures opérationnelles (hors `balance`, `cumul_*`, `info_*`, etc.)
2. **Pas de double comptage** : charges déjà dans le CR ne sont pas re-ajoutées au passif (`accruedExpenses = 0`)
3. **Historique immobilisé** : valorisation bâti = état **actuel** du parc (limitation connue pour tours passés)
4. **Enrichissement UI** : population / breakdowns restent sur cache `budget_turn_*` tant qu'ils ne sont pas journalisés
5. **Stabilité cumul trésorerie** : le write path continue de maintenir `budget_current` en parallèle du journal
