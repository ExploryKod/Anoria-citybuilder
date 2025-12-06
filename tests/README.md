# Tests - État actuel

## ✅ Ce qui fonctionne

### Tests sans mocking (162 tests passent)
- **TimeManager.test.js** (33 tests) - Calcul du temps, mois, saisons, années
- **EmployeeHelper.test.js** (39 tests) - Secteurs, employés, salaires
- **ModuleHelper.test.js** (31 tests) - Routes, nourriture, évolution maisons
- **utils.test.js** (30 tests) - IDs, prix, zones de construction
- **config.test.js** (29 tests) - Validation de la configuration

### Tests avec mocking (21 tests passent)
- **EmployeeHelper.localStorage.test.js** (8 tests) - Priorités d'emploi dans localStorage
- **BudgetManager.test.js** (13 tests passent, 3 échouent) - Gestion budgétaire avec IndexedDB

## ⚠️ Problèmes restants

### BudgetManager.test.js - 3 tests échouent

**Tests concernés :**
- `cumule plusieurs revenus`
- `soustrait des dépenses du budget`
- `peut avoir un budget négatif (dette)`

**Cause :** La méthode `getCurrentBudget()` synchronise automatiquement le budget avec `config.budget.initialFunds`. Cette logique métier interfère avec les tests qui modifient le budget.

**Solution possible :** 
- Soit désactiver temporairement cette synchronisation dans les tests
- Soit tester directement les méthodes sans passer par `getCurrentBudget()`
- Soit adapter les tests pour tenir compte de cette logique métier

## 📊 Statistiques

```
Test Suites: 6 passed, 1 failed (BudgetManager)
Tests: 183 passed, 3 failed, 186 total
```

## 🛠️ Infrastructure

- **Jest** configuré avec support ESM
- **fake-indexeddb** installé pour mocker IndexedDB
- **Mock localStorage** dans `tests/setup.js`
- **Mock import.meta.env** dans le code de production

## 📝 Notes

Les tests avec mocking fonctionnent correctement. `fake-indexeddb` persiste bien les données en mémoire pendant l'exécution des tests. Les 3 échecs sont dus à la logique métier de synchronisation, pas à un problème de mocking.

