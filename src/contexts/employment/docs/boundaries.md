# Employment — DDD boundaries (Housing, Supply)

Employment is **downstream** of Housing for residential facts and **read-only** on Supply for food (consumption is Supply’s write path).

## Published facts consumed (not owned)

From persisted house rows (today: `DexieEmploymentBuildingRepository` → Dexie `houses` table):

| Field | Owner | Employment use |
|---|---|---|
| `type`, `pop`, `roadCount` | Housing (mutations); Parcels (`roadCount` calc) | `LaborPoolPolicy` → `workerPool`, `elitePool` |
| `employees.*` | Employment | redistribution writes |

Employment **does not** import `contexts/housing/domain/**`. Legacy UI uses `src/js/acl/employment.js`.

Presentation flow (bar + `no-work` icons): [`docs/presentation.md`](presentation.md).

## Ubiquitous language stays local

| Term in Employment | Meaning here |
|---|---|
| **Citizen** | Resident **worker-eligible** (`citizenPopFromHouse`) |
| **Élite** | Palace resident **beyond citizen cap** — display / future elite jobs; **not** subtracted from citizens |
| **workerPool** | Σ citizens (road-connected houses only) |

Housing speaks of **residents** and **total `pop`**. Same numbers, different concepts.

## `LaborPoolPolicy` stays in Employment

`workerPopFromHouse`, `elitePopFromHouse`, `citizenPopFromHouse` remain Employment domain policies.

Palace `pop + 1` on evolution is a **Housing** mutation (`HouseEvolutionPolicy`). Employment reads the resulting `pop` on the next redistribution tick.

## Optional alignment test

If product rules require palace headcount split to match pool split **today**, add an integration/contract test — do **not** share policy code across BCs unless promoting a true Shared Kernel concept (we have not).

See: `housing/docs/refactor.md` (DDD boundaries section).
