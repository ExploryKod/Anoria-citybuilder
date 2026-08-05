# Shared Kernel: Population

**Vocabulary module** for citizen status across Housing, Employment, and Accounting contexts.

## NOT a Bounded Context

This is **not** a BC in the DDD sense because:
- No invariants to defend
- No mutations or lifecycle
- No autonomous decision-making
- Pure reference data (readonly catalog)

## Design Philosophy

A citizen **STATUS** is a social contract defining:

### 1. **Skills** (Compétences) → what you CAN do
- Production capabilities (subsistence-forager, etc.)
- Employment eligibility (employment-eligible, etc.)
- Special abilities (governance, administration, etc.)

**Skills are CUMULATIVE** — higher statuses add to the base set:
- `hunter-gatherer`: subsistence-forager
- `worker`: subsistence-forager + employment-eligible
- `civil-servant`: subsistence-forager + administration

### 2. **Duties** (Devoirs) → what you MUST do/pay
- Fiscal obligations (taxpayer, payrollTax)
- Social obligations (publicService, leadership, etc.)

### 3. **Rights** (Droits) → what you RECEIVE
- Income entitlements (salary, unemployment benefits, pension)
- Social protection (healthcare, education — future)
- Political rights (vote, hold office — future)

### 4. **Housing Metadata** (Documentation only)
- Descriptive information about typical housing requirements
- **NOT enforced logic** — the Housing BC determines status from house level
- Used for:
  - Documentation clarity (what housing goes with what status)
  - Special constraints (e.g., youth depends on parents)
  - Future game design (special status with housing prerequisites)

## Architecture

```
shared/population/
├── CitizenStatusCatalog.js  ← readonly status profiles (vocabulary)
├── computePopulationBreakdown.js
└── README.md
```

Housing owns level-2 profession skills and placement unlocks (`contexts/housing/domain/policies/GroupLevel2*`). Employment owns workplace skill requirements (`WorkplaceSkillRequirementPolicy`). Presentation owns French labels (`presentation/dom/info/population/`).

Each BC **projects its own view** from the catalog:

- **Housing** → resident growth, food consumption
- **Employment** → labor pool eligibility, sector restrictions
- **Accounting** → tax liability, income/expense flows

## Status profiles (v2 — Skills + Duties + Rights)

| Status | Skills | Duties | Rights (Income) |
|---|---|---|---|
| **hunter-gatherer** | subsistence-forager | none | none |
| **worker** | subsistence-forager<br>+ employment-eligible | taxpayer<br>payrollTax | employer-paid ×1.0 |
| **unemployed** | subsistence-forager<br>+ employment-eligible | taxpayer<br>payrollTax | city-paid ×0.7 |
| **civil-servant** | subsistence-forager<br>+ administration | taxpayer<br>payrollTax<br>publicService | city-paid ×1.0 |
| **elite** | governance | taxpayer<br>payrollTax<br>leadership | employer-paid ×2.0 |
| **youth** (future) | learning | parentalObedience | none (dependent) |
| **retired** (future) | subsistence-forager (×0.5)<br>+ elder-wisdom | none | city-paid ×0.6 (pension) |

### Key Design: Cumulative Skills

**workers** keep their subsistence skills from hunter-gatherer status + gain employment skills!

This reflects reality: artisans still forage/hunt to supplement income, they don't lose ancestral skills.

## Usage by BCs

### Employment

```javascript
import { resolveCitizenStatusFromLevel, getCitizenStatusProfile } 
  from '../../../../shared/population/CitizenStatusCatalog.js';

export function workerPopFromHouse(type, pop, level = 2) {
  const statusKey = resolveCitizenStatusFromLevel(level);
  const profile = getCitizenStatusProfile(statusKey);
  
  if (!profile.employment.countsInLaborPool) return 0;
  
  return citizenPopFromHouse(type, pop, level);
}
```

### Accounting

```javascript
import { resolveCitizenStatusFromLevel, getCitizenStatusProfile } 
  from '../../../../shared/population/CitizenStatusCatalog.js';

export function computeCitizenTaxBreakdown(houses, taxPerCapita) {
  for (const house of houses) {
    const statusKey = resolveCitizenStatusFromLevel(house.level ?? 1);
    const profile = getCitizenStatusProfile(statusKey);
    
    if (!profile.accounting.paysCitizenTax) continue;
    
    // ... tax calculation
  }
}
```

### Housing

Housing does not need to consume this catalog directly today (growth is uniform across statuses). Future consumption point: if youth/retired affect growth rate.

## Housing Metadata: Causality & Usage

The `housingMetadata` field documents the relationship between citizen status and housing, but it's **descriptive, NOT prescriptive**.

### Causality Direction

```
house.level → citizen status   ✓ (Housing BC determines status)
citizen status ↛ housing access ✗ (Status doesn't grant housing rights)
```

**Why?** The game design is:
1. Player builds a house (level 1: cabane)
2. House evolves to level 2 (masure) when conditions are met (route + pop)
3. The house level **determines** the citizen status (hunter-gatherer → worker)

**Not the reverse** — citizens don't "earn the right" to live in level 2 houses.

### When to Use `housingMetadata`

1. **Documentation** — Understanding what housing corresponds to each status
2. **Special constraints** — Youth depends on parents (no independent housing)
3. **Future game design** — Status with specific housing *prerequisites* (e.g., "scholar" requires library-adjacent housing)

### Example: Youth Housing Constraint

```javascript
import { getCitizenStatusProfile } from './CitizenStatusCatalog.js';

const profile = getCitizenStatusProfile('youth');
console.log(profile.housingMetadata.constraint); // 'parent-dependent'
console.log(profile.housingMetadata.typicalLevel); // null (depends on parents)
```

The Housing BC can use this metadata for validation, but it doesn't grant housing access.

## Extension strategy

To add a new status (e.g., `'apprentice'`):

1. Add entry to `CITIZEN_STATUS_PROFILES` in `CitizenStatusCatalog.js`
2. Define projections for housing/employment/accounting
3. Update `resolveCitizenStatusFromLevel()` if resolution logic changes
4. BCs automatically inherit the new status semantics

No BC code needs to change unless the status requires new **policy logic** (e.g., apprentice-specific tax rate).

## Testing

```bash
npm test -- --testPathPatterns="CitizenStatusCatalog"
```

Tests verify:
- Profile completeness (all statuses have all projections)
- Immutability (Object.freeze)
- Resolution logic (level → status mapping)

## Relations to BCs

| BC | Uses catalog for | Owns policy for |
|---|---|---|
| **Housing** | (future) growth eligibility | Population growth invariants (`+1/month`) |
| **Employment** | Labor pool inclusion | Worker allocation algorithm |
| **Accounting** | Tax/income rules | Budget operations, journal entries |

Each BC remains **autonomous** — the catalog is an input, not a replacement for domain logic.
