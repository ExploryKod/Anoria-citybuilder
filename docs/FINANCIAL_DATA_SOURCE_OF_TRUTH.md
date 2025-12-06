# Source de Vérité - Données Financières

## ✅ Vérification de la cohérence Budget ↔ Journal

### Source de vérité unique : IndexedDB via BudgetManager

**Toutes les données financières proviennent d'IndexedDB via `BudgetManager` :**
- Budget actuel : `budgetManager.getCurrentBudget()` → `db.budget`
- États de budget : `budgetManager.getBudgetStates()` → `db.budget` (filtre `budget_turn_X`)
- Entrées de journal : `budgetManager.getJournalEntries()` → `db.journal`

---

## 📊 Budget (Panneau Finances)

### Source des données
- **Service** : `FinancialYearService`
- **Source** : `BudgetManager` → IndexedDB (`db.budget`)
- **Méthodes utilisées** :
  - `getCurrentBudget()` - Budget actuel
  - `getBudgetStates()` - États sauvegardés par tour
  - Calculs annuels basés sur les totaux cumulés

### Données affichées
- **Cette année** : Totaux actuels - Totaux de l'année dernière
- **Année dernière** : Snapshot sauvegardé (créé à l'ouverture du panneau)
- **Toutes les valeurs** : Depuis IndexedDB (pas de données hardcodées)

---

## 📔 Journal des Écritures

### Source des données
- **Fonction** : `loadJournalEntries()` dans `buttons.js`
- **Source** : `budgetManager.getJournalEntries()` → IndexedDB (`db.journal`)
- **Pas de données hardcodées** : Toutes les entrées viennent d'IndexedDB

### Création des entrées
Toutes les transactions financières créent automatiquement une entrée de journal :

1. **Revenus** :
   - `addIncome()` → `addJournalEntry('income', amount, source)`
   - `addTaxes()` → `addJournalEntry('income', total, description)`

2. **Dépenses** :
   - `addExpense()` → `addJournalEntry('expense', amount, reason)`
   - `addBuildingMaintenance()` → `addJournalEntry('maintenance', amount, description)`
   - `addLoanInterest()` → `addJournalEntry('loan_interest', amount, description)`
   - `addLoanRepayment()` → `addJournalEntry('loan_repayment', amount, description)`

### Synchronisation du Turn
- **Budget** : `budget.turn` mis à jour via `budgetManager.updateTurn(time)` dans `scene.js`
- **Journal** : Chaque entrée utilise `budget.turn` au moment de la création
- **Cohérence** : ✅ Même `turn` pour budget et journal

---

## 🔄 Flux de données

```
┌─────────────────────────────────────────────────────────┐
│                    IndexedDB (Source de vérité)         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ db.budget    │  │ db.journal   │  │ db.houses    │  │
│  │ (budget_*)   │  │ (entries)    │  │ (buildings)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              BudgetManager (API unique)                 │
│  • getCurrentBudget()                                   │
│  • getBudgetStates()                                     │
│  • getJournalEntries()                                   │
│  • addIncome() → addJournalEntry()                      │
│  • addExpense() → addJournalEntry()                     │
│  • addTaxes() → addJournalEntry()                      │
│  • addBuildingMaintenance() → addJournalEntry()         │
└─────────────────────────────────────────────────────────┘
         │                    │
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              Services & UI                               │
│  ┌──────────────────────┐  ┌──────────────────────┐     │
│  │ FinancialYearService │  │ loadJournalEntries()│     │
│  │ (Panneau Finances)   │  │ (Journal UI)        │     │
│  └──────────────────────┘  └──────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Vérifications effectuées

### 1. Source de vérité unique
- ✅ Budget : IndexedDB via `BudgetManager`
- ✅ Journal : IndexedDB via `BudgetManager`
- ✅ Pas de duplication dans localStorage (sauf snapshot temporaire)

### 2. Synchronisation des transactions
- ✅ Chaque transaction met à jour le budget ET crée une entrée de journal
- ✅ Même `turn` utilisé pour budget et journal
- ✅ Mêmes montants dans budget et journal

### 3. Pas de données hardcodées
- ✅ Budget : Toutes les valeurs depuis IndexedDB
- ✅ Journal : Toutes les entrées depuis IndexedDB
- ✅ Pas de valeurs statiques ou fake

### 4. Cohérence des montants
- ✅ `addIncome(amount)` → budget.income += amount ET journal entry avec amount
- ✅ `addExpense(amount)` → budget.expenses += amount ET journal entry avec amount
- ✅ `addTaxes()` → budget.totalTaxes += total ET journal entry avec total
- ✅ `addBuildingMaintenance(amount)` → budget.totalBuildingMaintenance += amount ET journal entry avec amount

---

## 📝 Notes importantes

### Turn (Tour)
- Le `turn` est mis à jour dans `scene.js` via `budgetManager.updateTurn(time)`
- Toutes les entrées de journal utilisent `budget.turn` au moment de leur création
- Le journal groupe les entrées par `turn` pour l'affichage

### Snapshot de l'année dernière
- Créé dans `localStorage` (cache temporaire) au moment de l'ouverture du panneau finances
- Source de vérité reste IndexedDB
- Le snapshot est recalculé si nécessaire depuis IndexedDB

### Maintenance mensuelle
- Calculée depuis les bâtiments dans `db.houses` (IndexedDB)
- Créée via `addBuildingMaintenance()` qui met à jour le budget ET crée une entrée de journal
- Breakdown détaillé inclus dans la description de l'entrée de journal

---

## 🎯 Conclusion

**Le journal et le budget utilisent la même source de vérité (IndexedDB via BudgetManager).**

Toutes les transactions financières :
1. Mettent à jour le budget dans IndexedDB
2. Créent une entrée de journal dans IndexedDB
3. Utilisent le même `turn` et les mêmes montants

**Aucune incohérence possible** : Les deux systèmes lisent et écrivent dans la même base de données via la même API (`BudgetManager`).

