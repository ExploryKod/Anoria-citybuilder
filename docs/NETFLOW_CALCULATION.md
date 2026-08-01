# Calcul du Flux Net (Net Flow) dans l'Administrator Panel

## Vue d'ensemble

Le **flux net** (`netFlow`) représente la différence entre les **revenus totaux** et les **dépenses totales** pour une année donnée. Le **report de solde** de l'année précédente est affiché séparément entre le flux net et la balance.

## Source de vérité

**IMPORTANT** : Le panneau finances utilise maintenant **`JournalManager.getYearlyFinancialSummary()`** comme source de vérité, exactement comme le journal de comptabilité. Cela garantit que les données affichées dans l'administrator-panel sont **synchronisées en temps réel** avec chaque transaction.

- **`JournalManager`** : Source de vérité unique pour toutes les données financières
- **`getYearlyFinancialSummary()`** : Agrège les entrées du journal par année
- **`currentBudget`** : Utilisé uniquement pour obtenir le solde actuel (balance)

### Synchronisation

```javascript
// À chaque transaction (addIncome, addExpense, etc.) :
1. Mise à jour du currentBudget (IndexedDB)
2. Création d'une entrée dans le journal (IndexedDB)
3. L'administrator-panel lit le journal via JournalManager → affichage instantané

// Tous les 3 tours :
- Sauvegarde d'un budgetState (snapshot pour historique)
```

## Formule générale

```
netFlow = totalIncome - totalExpenses
balance = currentBudget.funds (solde actuel)
previousYearBalance = solde de fin d'année précédente (affiché séparément)
```

## Calcul pour "Cette Année" (`mapJournalDataToUI`)

### 1. Calcul des revenus et dépenses de l'année en cours

Les valeurs sont calculées **en temps réel** depuis le journal via `JournalManager.getYearlyFinancialSummary()` :

```javascript
// Obtenir les données annuelles depuis le journal
const yearlyData = await journalManager.getYearlyFinancialSummary();
const thisYearData = yearlyData.find(y => y.year === currentYear);

// Extraire les montants par type depuis les entrées du journal
const incomeTax = thisYearData.income.entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);

const gifts = thisYearData.income.entries
    .filter(e => e.type === 'capital_funds')
    .reduce((sum, e) => sum + e.amount, 0);

const maintenance = thisYearData.expenses.entries
    .filter(e => e.type === 'maintenance')
    .reduce((sum, e) => sum + e.amount, 0);

const construction = thisYearData.expenses.entries
    .filter(e => e.type === 'construction')
    .reduce((sum, e) => sum + e.amount, 0);

const interestExpense = thisYearData.expenses.entries
    .filter(e => e.type === 'loan_interest')
    .reduce((sum, e) => sum + e.amount, 0);
```

**Détail des composantes :**

#### Revenus (`thisYearIncome`) :
- **Impôts sur le revenu** (`incomeTax`) : Entrées de type `'income'` (taxes collectées)
- **Dons** (`gifts`) : Entrées de type `'capital_funds'` (fonds initiaux)
- **TVA** (`vat`) : 0 (pas encore implémenté)
- **Taxes commerciales** (`tradeTax`) : 0 (pas encore implémenté)
- **Intérêts (gain)** (`interestIncome`) : 0 (pas encore implémenté)

#### Dépenses (`thisYearExpenses`) :
- **Salaires** (`salaries`) : 0 (pas encore implémenté)
- **Intérêts** (`interestExpense`) : Entrées de type `'loan_interest'`
- **Maintenance** (`maintenance`) : Entrées de type `'maintenance'`
- **Construction** (`construction`) : Entrées de type `'construction'`
- **Dépenses exceptionnelles** : Entrées de type `'exceptional_expenses'` (incluses dans totalExpenses)

### 2. Calcul du solde actuel

```javascript
// Le solde actuel provient du currentBudget
balance = currentBudget.funds
```

Le solde est affiché dans la ligne "Balance" du tableau.

### 3. Calcul final du flux net

```javascript
netFlow = totalIncome - totalExpenses
```

**Exemple :**
- Revenus de l'année : 1000€
- Dépenses de l'année : 800€
- Solde de l'année précédente : +150€ (affiché séparément)

```
totalIncome = 1000€
totalExpenses = 800€
netFlow = 1000 - 800 = 200€
previousYearBalance = 150€ (affiché sur une ligne séparée)
balance = fonds actuels dans IndexedDB
```

## Calcul pour "Année Dernière" (`mapJournalDataToUI`)

### 1. Calcul des revenus et dépenses de l'année dernière

Les valeurs proviennent directement du journal via `JournalManager.getYearlyFinancialSummary()` :

```javascript
// Obtenir les données annuelles depuis le journal
const yearlyData = await journalManager.getYearlyFinancialSummary();
const lastYearData = yearlyData.find(y => y.year === currentYear - 1);

// Si l'année dernière n'existe pas dans le journal, retourner des valeurs vides
if (!lastYearData) {
    return getEmptyYearData(currentYear - 1);
}

// Extraire les montants par type depuis les entrées du journal
// (même logique que pour "Cette Année")
```

Les données de l'année dernière sont calculées de la même manière que cette année, mais à partir des entrées du journal de l'année précédente.

## Cas particuliers

### Première année (année 0)

- **Cette année** :
  - `lastYearSnapshot = null`
  - `previousYearBalance = 0`
  - `netFlow = thisYearIncome - thisYearExpenses`

- **Année dernière** :
  - Retourne toutes les valeurs à `0` (pas d'année précédente)
  - `netFlow = 0`

### Report de solde

Le report de solde est maintenant affiché sur une ligne séparée entre le flux net et la balance.

```
Flux net : 200€ (revenus - dépenses de l'année)
Report de solde : +150€ (solde de l'année précédente)
Balance : 350€ (fonds actuels = flux net + report)
```

## Source de vérité

- **IndexedDB** (`BudgetManager`) : 
  - `currentBudget` : Mis à jour en temps réel à chaque transaction (comme le journal)
  - `budgetStates` : Snapshots sauvegardés tous les 3 tours (historique uniquement)
- **Journal** : Entrées créées à chaque transaction (synchronisé avec `currentBudget`)

## Notes importantes

1. **Synchronisation en temps réel** : la section Finances admin utilise le livret via ACL (`getCityLedgerYearComparison`), aligné sur le journal.

2. **Source de vérité unique** : Toutes les données financières proviennent du journal (IndexedDB), qui est la source de vérité unique pour toutes les transactions.

3. **Agrégation par année** : Les données sont agrégées par année depuis les entrées du journal, sans calculs complexes de soustraction ou de snapshot.

4. **Mapping des types** : Les types du journal (`income`, `capital_funds`, `maintenance`, `construction`, `loan_interest`, `exceptional_expenses`) sont mappés vers les catégories de l'UI.

5. **Solde actuel** : Le solde (balance) provient du `currentBudget` pour refléter l'état actuel des fonds.

