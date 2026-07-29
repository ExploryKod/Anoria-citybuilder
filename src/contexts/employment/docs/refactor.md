# Employment — refactor notes

## Statut

| Slice | Statut |
|---|---|
| A — `GetCityEmploymentSummary` + wiring UI | ✅ fait |
| C — timing (redistribution post-évolution pop) | ✅ fait |
| D — redistribution placement / demolish | ✅ fait |

---

## Sync lag: status-bar unemployment vs building `no-work` icons

**Symptom (historique):** After a turn, buildings could show the red `no-work` icon while the status bar still showed a non-matching unemployment % (or the reverse). Figures only lined up on the **next** month.

**Root cause:** Two presentation surfaces read employment state on **different pipelines** with **different formulas**, and allocation ran before pop evolution.

### Target architecture (implemented)

**Single read model** — `GetCityEmploymentSummary` returns `{ workerPool, totalAssigned, unemployed, lack, understaffedBuildingIds, bySector }` from the same rules as `DistributeCityWorkers`. Status bar, work-section, and icons consume the ACL helper.

**One labor-pool policy (Employment BC)** — `LaborPoolPolicy` interprets persisted `type` + `pop` into worker vs élite pools. Housing owns `pop` mutations (growth, palace +1); Employment does **not** import Housing domain. See [`boundaries.md`](boundaries.md).

**Same-turn consistency** — monthly turn order in `game.js`:

```
ECS runtime
  → services (Food, Windmill, … — no redistribution)
  → scene.update (pop evolution, sprites, budget)
  → redistributeCityEmployment()
  → scene.refreshEmploymentPresentation()
```

**roadCount** — no-work icons and lack metrics only for road-eligible workplaces (`roadCount > 0`).

**Status bar** — deux indicateurs séparés :
- chômage (icône + `0 (0%)`) via `.display-unemployed-pop`
- manque global (chiffre seul, rouge, toujours visible) via `.display-worker-lack`

**Info panel** — `roadCount > 0` → workers/workerNeed (+ élites affichables) ; sinon « Route nécessaire pour embaucher ».

**Placement / demolish** — `syncEmploymentAfterBuildingChange` in ACL: redistribute + refresh when the building type is a workplace (`worker_need > 0`).

**UX copy** — optionally distinguish “chômeurs” (labor surplus) vs “bâtiment sans employés” (`no-work`).

---

## Original audit (pre-refactor)

### Surfaces that diverged

| Surface | Issue |
|---|---|
| Status bar (`scene.js`) | Duplicated pool formula; no lack |
| Work-section | Same formula copy-pasted |
| no-work icons | No `roadCount` check |
| Info panel | Staffing shown without road; elites in staffing status |

### Target flow (reference)

```
game.js update(time)
  └── scene.update → pop evolution
  └── redistributeCityEmployment
  └── refreshEmploymentPresentation
        → GetCityEmploymentSummary
        → bar: unemployed + lack
        → icons: id ∈ understaffedBuildingIds
```

See [`univers.md`](univers.md) and [`rules.md`](rules.md) for domain rules.
