# Shared Kernel: Population — Implémentation

**Date**: 2026-08-04  
**Status**: ✅ Completed

## Contexte

Les 5 dimensions d'un citoyen (fiscal, employabilité, revenu, secteurs, employeur) étaient dispersées entre Housing, Employment et Accounting sans vocabulaire partagé.

## Décision architecturale

**PAS un Bounded Context** mais un **Shared Kernel** (readonly catalog) consommé par les 3 BC existants.

### Justification (vs BC Population)

| Critère Evans | BC légitime ? |
|---|---|
| Langage ubiquitaire distinct | ❌ Vocabulaire dérivé des BC existants |
| Invariants propres | ❌ Tous portés par Housing/Employment/Accounting |
| Autonomie décisionnelle | ❌ Simple projection de données |
| Modèle conceptuel différent | ❌ Même `house.pop`, vues différentes |

**Conclusion** : Shared Kernel = bonne pratique DDD pour vocabulaire partagé sans créer de dépendance forte.

## Structure créée

```
src/shared/population/
├── CitizenStatusCatalog.js    ← 7 profils (hunter-gatherer, worker, unemployed, civil-servant, elite, youth, retired)
└── README.md                   ← doc Shared Kernel

tests/shared/population/
└── CitizenStatusCatalog.test.js ← 13 tests (immutabilité, complétude, sémantique métier)
```

## Profils de statut

| Status | Level | Employable | Pays impôt | Revenu | Source revenu | Multiplier |
|---|---|---|---|---|---|---|
| `hunter-gatherer` | 1 | ❌ | ❌ | ❌ | self-sufficient | 0.0 |
| `worker` | 2 | ✅ | ✅ | ✅ | employer-paid | 1.0 |
| `unemployed` | 2 | ✅ (cherche) | ✅ | ✅ | city-paid | 0.7 |
| `civil-servant` | 2 | ❌ (assigné) | ✅ | ✅ | city-paid | 1.0 |
| `elite` | Palace | ❌ | ✅ | ✅ | employer-paid | 2.0 |
| `youth` | any | ❌ | ❌ | ❌ | none | 0.0 |
| `retired` | any | ❌ | ❌ | ❌ | none | 0.0 |

**Note** : `youth` et `retired` sont des placeholders pour futures mécaniques d'âge.

## Intégration dans les BC

### Employment (`LaborPoolPolicy.js`)

```javascript
import { resolveCitizenStatusFromLevel, getCitizenStatusProfile } 
  from '../../../../shared/population/CitizenStatusCatalog.js';

export function citizenPopFromHouse(type, pop, level = 2) {
  const statusKey = resolveCitizenStatusFromLevel(level);
  const profile = getCitizenStatusProfile(statusKey);
  
  if (!profile.employment.countsInLaborPool) return 0;
  
  // ... reste de la logique
}
```

### Accounting (`CitizenTaxCollectionPolicy.js`)

```javascript
import { resolveCitizenStatusFromLevel, getCitizenStatusProfile } 
  from '../../../../shared/population/CitizenStatusCatalog.js';

export function computeCitizenTaxBreakdown(houses, taxPerCapita) {
  for (const house of houses) {
    const statusKey = resolveCitizenStatusFromLevel(house.level ?? 1);
    const profile = getCitizenStatusProfile(statusKey);
    
    if (!profile.accounting.paysCitizenTax) continue;
    
    // ... calcul impôt
  }
}
```

## Tests

```bash
npm test
```

**Résultats** : ✅ **809 tests passent** (107 suites)

- 13 tests Shared Kernel (`CitizenStatusCatalog.test.js`)
- 17 tests Employment (dont `LaborPoolPolicy`)
- 4 tests Accounting (dont `CitizenTaxCollectionPolicy`)
- 7 tests architecture boundaries (aucune violation)

## Documentation mise à jour

### Fichiers modifiés

1. **`src/shared/population/README.md`** (nouveau) — doc Shared Kernel
2. **`src/contexts/employment/README.md`** — section Relations
3. **`src/contexts/employment/docs/boundaries.md`** — mention catalogue
4. **`src/contexts/accounting/README.md`** — (tentative, fichier long)

## Extensibilité

Pour ajouter un nouveau statut (ex. `'apprentice'`) :

1. Ajouter entrée dans `CITIZEN_STATUS_PROFILES`
2. Définir `housing`, `employment`, `accounting` projections
3. Update `resolveCitizenStatusFromLevel()` si besoin
4. Les BC héritent automatiquement du statut

**Aucun changement BC** sauf si nouvelle policy métier (ex. taux d'impôt spécifique apprenti).

## Avantages obtenus

| Dimension | Avant | Après |
|---|---|---|
| **Clarté** | Règles éparpillées (level === 1 ? ...) | Profil explicite dans catalogue |
| **Cohérence** | Duplication logique Employment/Accounting | Source unique de vérité |
| **Tests** | Logique métier mélangée | 13 tests unitaires catalogue isolés |
| **Extensibilité** | Ajouter statut = toucher 3 BC | Ajouter statut = 1 entrée catalogue |
| **DDD** | Vocabulaire implicite | Shared Kernel explicite |

## Décisions de design

### Immutabilité

Tous les profils sont `Object.freeze()` profond — garantit readonly.

### Pas de BC

Population n'a **aucun** invariant propre ni mutation. C'est un **catalogue passif**, pas un domaine métier riche.

### Projections par BC

Chaque BC lit **uniquement sa projection** :
- `profile.employment.*`
- `profile.accounting.*`
- `profile.housing.*` (future consommation)

### Résolution level → status

Fonction `resolveCitizenStatusFromLevel(level)` centralise la logique actuelle (1 → hunter-gatherer, 2 → worker).

Future extension : résolution par `(level, age, houseType)` → status plus fin.

## Migration non-breaking

✅ **Aucun changement de comportement** — les tests existants passent sans modification.

La migration remplace les conditions `if (level === 1)` par des lookups catalogue tout en gardant la même sémantique.

## Prochaines étapes (optionnelles)

1. **Housing growth** : consommer `profile.housing.contributesToGrowth` si démographie détaillée
2. **Payroll detail** : utiliser `profile.accounting.incomeMultiplier` pour calculs salaires détaillés
3. **Age mechanics** : activer `youth` / `retired` quand cycle de vie citoyen implémenté
4. **Sector eligibility** : remplacer `'by-group'` par résolution dynamique depuis catalogue

## Références

- [Evans DDD] Shared Kernel pattern (Ch. 14)
- [Vernon IDDD] Context Mapping patterns
- Conversation Cursor : analyse "Population BC vs Shared Kernel" (2026-08-04)
