# Calcul du Flux Net (Net Flow) dans l'Administrator Panel

## Vue d'ensemble

Le **flux net** (`netFlow`) représente la différence entre les **revenus totaux** et les **dépenses totales** pour une année donnée. Le **report de solde** de l'année précédente est affiché séparément entre le flux net et la balance.

## Source de vérité

**IMPORTANT** : Le `FinancialYearService` utilise maintenant le **`currentBudget`** (mis à jour en temps réel) comme source de vérité, exactement comme le journal de comptabilité. Cela garantit que les données affichées dans l'administrator-panel sont **synchronisées en temps réel** avec chaque transaction.

- **`currentBudget`** : Mis à jour instantanément à chaque transaction (`addIncome`, `addExpense`, etc.)
- **`budgetStates`** : Snapshots sauvegardés tous les 3 tours (utilisés uniquement pour l'historique)
- **Journal** : Entrées créées à chaque transaction (même timing que `currentBudget`)

### Synchronisation

```javascript
// À chaque transaction (addIncome, addExpense, etc.) :
1. Mise à jour du currentBudget (IndexedDB)
2. Création d'une entrée dans le journal (IndexedDB)
3. L'administrator-panel lit le currentBudget → affichage instantané

// Tous les 3 tours :
- Sauvegarde d'un budgetState (snapshot pour historique)
```

## Formule générale

```
netFlow = totalIncome - totalExpenses
balance = currentBudget.funds (solde actuel)
previousYearBalance = solde de fin d'année précédente (affiché séparément)
```

## Calcul pour "Cette Année" (`calculateThisYearData`)

### 1. Calcul des revenus et dépenses de l'année en cours

Les valeurs sont calculées **en temps réel** depuis le `currentBudget` :

```javascript
// Si première année (année 0) :
thisYearIncome = currentBudget.income
thisYearExpenses = currentBudget.expenses
thisYearTaxes = currentBudget.totalTaxes
// etc.

// Si année suivante :
thisYearIncome = currentBudget.income - lastYearSnapshot.income
thisYearExpenses = currentBudget.expenses - lastYearSnapshot.expenses
// etc.
```

**Détail des composantes :**

#### Revenus (`thisYearIncome`) :
- **Impôts sur le revenu** (`thisYearTaxes`) : Taxes collectées depuis le début de l'année
- **Dons** (`gifts`) : Fonds initiaux (première année) + dons réels de l'année
- **Autres revenus** (`otherIncome`) : `thisYearIncome - thisYearTaxes - thisYearTotalGifts`

#### Dépenses (`thisYearExpenses`) :
- **Salaires** (`salaries`) : 0 (pas encore implémenté)
- **Intérêts** (`interestExpense`) : Intérêts sur les prêts
- **Maintenance** (`maintenance`) : Maintenance des bâtiments (`totalBuildingMaintenance`)
- **Construction** (`construction`) : Investissements (`totalInvestments`)

### 2. Calcul du report de solde de l'année précédente

```javascript
if (lastYearSnapshot) {
    previousYearBalance = lastYearSnapshot.balance || lastYearSnapshot.funds || 0;
}
```

Le report de solde est affiché séparément (pas inclus dans les totaux).

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

## Calcul pour "Année Dernière" (`calculateLastYearData`)

### 1. Calcul des revenus et dépenses de l'année dernière

Les valeurs proviennent du snapshot de l'année dernière :

```javascript
// Si l'année dernière était la première année (année 0) :
totalIncome = snapshot.income  // Inclut les fonds initiaux
lastYearRealGifts = snapshot.totalGifts  // Inclut les fonds initiaux

// Si année suivante :
totalIncome = snapshot.income  // Revenus cumulés
lastYearRealGifts = snapshot.totalGifts - previousYearGifts  // Dons de l'année uniquement
```

### 2. Calcul du report de solde de l'année précédente à l'année dernière

Si l'année dernière n'était pas la première année, elle avait une année précédente (année - 2) :

```javascript
if (!isLastYearFirstYear) {
    // Chercher l'état de fin d'année de l'année précédente (année - 2)
    const previousYearStates = budgetStates.filter(state => {
        const stateYear = Math.floor(state.turn / 12);
        return stateYear === previousYear;  // previousYear = lastYear - 1
    });
    
    if (previousYearStates.length > 0) {
        const lastPreviousState = previousYearStates[previousYearStates.length - 1];
        const previousYearBalance = lastPreviousState.funds || 0;
        
        if (previousYearBalance > 0) {
            previousYearGains = previousYearBalance;
        } else if (previousYearBalance < 0) {
            previousYearDebts = Math.abs(previousYearBalance);
        }
    }
}
```

### 3. Ajustement des totaux

```javascript
adjustedLastYearIncome = totalIncome + previousYearGains
adjustedLastYearExpenses = snapshot.expenses + previousYearDebts
```

### 4. Calcul final du flux net

```javascript
netFlow = adjustedLastYearIncome - adjustedLastYearExpenses
```

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

1. **Synchronisation en temps réel** : Le `FinancialYearService` utilise maintenant le `currentBudget` directement (pas les `budgetStates`), garantissant que les données sont à jour à chaque transaction, exactement comme le journal.

2. **Valeurs cumulées** : Le `currentBudget` contient des totaux cumulés depuis le début du jeu. Il faut donc soustraire les totaux de l'année précédente pour obtenir les totaux de l'année en cours.

3. **Protection contre les valeurs négatives** : Toutes les valeurs sont protégées avec `Math.max(0, value)` pour éviter d'afficher des valeurs négatives ou invalides.

4. **Vérification des données fantômes** : En première année, si `turn <= 1` et qu'il n'y a pas d'entrées de journal de maintenance, `thisYearMaintenance` est forcé à 0.

5. **Report séparé** : Le report de solde est maintenant affiché sur une ligne séparée entre le flux net et la balance, au lieu d'être inclus dans les revenus/dépenses.

