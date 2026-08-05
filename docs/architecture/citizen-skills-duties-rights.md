# Citizen Status: Skills + Duties + Rights Architecture

**Date**: 2026-08-04  
**Status**: ✅ Implemented

## Context

Suite à l'observation que l'affichage UI "0 chasseurs → 3 artisans" était trompeur (suggérant que les artisans ne produisaient plus de subsistance), nous avons restructuré le `CitizenStatusCatalog` pour refléter une vision plus riche :

**Un STATUT = Skills (compétences) + Duties (devoirs) + Rights (droits)**

## Design Philosophy

### Problème avec l'ancien modèle

L'ancien catalogue traitait les statuts comme des **flags éparpillés** :
```javascript
'worker': {
  employment: { isEmployable: true },
  accounting: { paysCitizenTax: true },
}
```

Pas de notion de **compétences cumulatives** — le passage niveau 1 → 2 semblait remplacer les compétences au lieu de les ajouter.

### Nouveau modèle : Status = Contrat social

Un statut est maintenant un **contrat cohérent** définissant simultanément :

```javascript
'worker': {
  skills: {
    'subsistence-forager': { produces: { fruit: 1, game: 1 } },
    'employment-eligible': { eligibleSectors: 'by-group' },
  },
  duties: {
    taxpayer: true,
    payrollTax: true,
  },
  rights: {
    income: { receives: true, source: 'employer-paid', multiplier: 1.0 },
  },
}
```

## Key Innovation: Cumulative Skills

**Les skills s'AJOUTENT** au lieu de se remplacer :

| Evolution | Skills gained |
|---|---|
| Level 1 (cabane) | `subsistence-forager` |
| Level 2 (masure) | **KEEPS** `subsistence-forager`<br>+ **ADDS** `employment-eligible` |

**Résultat UI souhaité** :
```
COMPOSITION DU FOYER
🏹 3 Chasseurs-cueilleurs
🔨 3 Artisans

STOCKS - Pastoralisme
🍎 3  🦌 3
```

Les artisans continuent de produire fruit/gibier car ils gardent leur skill de subsistance !

## Structure du catalogue

### Statuts actuels

#### hunter-gatherer (niveau 1)
- **Skills** : `subsistence-forager` uniquement
- **Duties** : aucun (pas d'impôts)
- **Rights** : aucun revenu (autarcie)

#### worker (niveau 2)
- **Skills** : `subsistence-forager` + `employment-eligible` (CUMULATIF)
- **Duties** : `taxpayer`, `payrollTax`
- **Rights** : income employer-paid ×1.0

#### unemployed (dynamique)
- **Skills** : identiques à worker
- **Duties** : identiques à worker
- **Rights** : income city-paid ×0.7 (allocation)

#### civil-servant (1 pour 12 hab.)
- **Skills** : `subsistence-forager` + `administration`
- **Duties** : `taxpayer`, `payrollTax`, `publicService`
- **Rights** : income city-paid ×1.0 (garanti)

#### elite (palais)
- **Skills** : `governance` (PAS de subsistance — luxe palais)
- **Duties** : `taxpayer`, `payrollTax`, `leadership`
- **Rights** : income employer-paid ×2.0

### Statuts futurs (placeholders)

#### youth (âge < 16, non implémenté)
- **Skills** : `learning` (école)
- **Duties** : `parentalObedience`
- **Rights** : éducation, santé

#### retired (âge ≥ 65, non implémenté)
- **Skills** : `subsistence-forager` (×0.5) + `elder-wisdom`
- **Duties** : aucun (exempté)
- **Rights** : pension city-paid ×0.6

## API

### Accessors

```javascript
import {
  hasSkill,
  getSkills,
  getDuties,
  getRights,
  getSkillNames,
} from 'shared/population/CitizenStatusCatalog.js';

// Check if a status has a skill
hasSkill('worker', 'subsistence-forager'); // true
hasSkill('worker', 'employment-eligible'); // true

// Get all skills
getSkills('worker');
// → { 'subsistence-forager': {...}, 'employment-eligible': {...} }

// Get duties
getDuties('worker');
// → { taxpayer: true, payrollTax: true }

// Get rights
getRights('worker');
// → { income: { receives: true, source: 'employer-paid', ... } }

// Get skill names array
getSkillNames('worker');
// → ['subsistence-forager', 'employment-eligible']
```

### Backward compatibility

Les **legacy projections** (housing, employment, accounting) sont maintenues pour éviter de casser les BC existants :

```javascript
profile.employment.countsInLaborPool; // Still works
profile.accounting.paysCitizenTax;    // Still works
```

Mais elles sont **dérivées** de skills/duties/rights :
- `employment.countsInLaborPool` = `hasSkill('employment-eligible')`
- `accounting.paysCitizenTax` = `duties.taxpayer`

## Intégration avec les BC

### Employment

```javascript
// LaborPoolPolicy.js (unchanged, uses legacy projection)
export function citizenPopFromHouse(type, pop, level = 2) {
  const statusKey = resolveCitizenStatusFromLevel(level);
  const profile = getCitizenStatusProfile(statusKey);
  
  if (!profile.employment.countsInLaborPool) return 0;
  // ...
}

// Future: can use skills directly
if (!hasSkill(statusKey, 'employment-eligible')) return 0;
```

### Accounting

```javascript
// CitizenTaxCollectionPolicy.js (unchanged, uses legacy projection)
const profile = getCitizenStatusProfile(statusKey);
if (!profile.accounting.paysCitizenTax) continue;

// Future: can use duties directly
if (!getDuties(statusKey).taxpayer) continue;
```

### Supply

```javascript
// HouseSubsistencePolicy.js (future enhancement)
const skills = getSkills(statusKey);
const foragerSkill = skills['subsistence-forager'];

if (foragerSkill) {
  const fruitAdded = pop * foragerSkill.produces.fruit;
  const gameAdded = pop * foragerSkill.produces.game;
}
```

## Tests

**25 tests** couvrent la nouvelle structure :
- 13 tests originaux (status semantics, legacy projections)
- 12 nouveaux tests (skills/duties/rights, cumulative behavior)

```bash
npm test -- --testPathPatterns="CitizenStatusCatalog"
# ✓ 25 passed
```

## Migration Path

### Phase actuelle (DONE)
1. ✅ Ajouter skills/duties/rights à tous les statuts
2. ✅ Maintenir legacy projections (housing/employment/accounting)
3. ✅ Ajouter helpers (`hasSkill`, `getSkills`, etc.)
4. ✅ Tests confirmant cumulative behavior

### Phases futures (optionnelles)

#### Phase 2 : Adapter UI (foyer panel)
- Afficher les skills cumulatifs au lieu de OR exclusif
- `resolveHouseholdComposition()` → retourner liste de skills

#### Phase 3 : Migrer BC vers skills directs
- Employment : remplacer `profile.employment.countsInLaborPool` par `hasSkill('employment-eligible')`
- Accounting : remplacer `profile.accounting.paysCitizenTax` par `getDuties().taxpayer`
- Supply : utiliser `getSkills()['subsistence-forager'].produces`

#### Phase 4 : Supprimer legacy projections
- Une fois tous les BC migrés, retirer housing/employment/accounting
- Garder uniquement skills/duties/rights

#### Phase 5 : Extensions gameplay
- Implémenter youth/retired avec mécaniques d'âge
- Ajouter skill `'literacy'` quand écoles disponibles
- Ajouter conditions complexes (`hasSchoolAccess`, etc.)

## Bénéfices

| Dimension | Avant | Après |
|---|---|---|
| **Clarté conceptuelle** | Flags éparpillés | Contrat social cohérent (Skills+Duties+Rights) |
| **Skills cumulatifs** | Implicite/ambigu | Explicite dans structure |
| **Extensibilité** | Ajouter statut = dupliquer flags | Ajouter statut = composer skills |
| **UI richesse** | "0 chasseurs / 3 artisans" (trompeur) | "3 chasseurs + 3 artisans" (clair) |
| **Tests** | 13 tests sémantiques | 25 tests (sémantique + structure) |
| **Game design** | Statut = état simple | Statut = progression avec accumulation |

## Relation avec le Shared Kernel existant

Ce refactoring **enrichit** le `CitizenStatusCatalog` sans créer de conflit :

- **Avant** : Status = ensemble de projections par BC
- **Après** : Status = Skills + Duties + Rights (+ legacy projections pour compatibilité)

Le catalogue reste un **Shared Kernel** (pas un BC) :
- Readonly, sans invariants
- Consommé par Housing, Employment, Accounting
- Source unique de vérité pour vocabulaire citoyen

## Références

- [Evans DDD] Shared Kernel pattern
- Conversation design : "Skills cumulatifs vs statut binaire" (2026-08-04)
- Issue originale : Affichage trompeur "0 chasseurs → 3 artisans"
