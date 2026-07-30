# Bug history

Resolved Supply bugs, newest first. Keep entries short: symptom → cause → fix → leftover debt if any.

---

## 2026-07-28 — Houses never receive food after autumn (no evolution)

**Symptom**
- After autumn harvest, house food stocks stay at `0` paniers.
- Evolution blocked on « Nourriture ≥ Population ».
- Market still shows food icons; console never logs `Distribution via Supply BC`.
- Pattern: autumn → buy works + « houses do not buy »; non-autumn → only « markets buy only in autumn », then silence.

**Cause**
- `DistributeFoodFromMarketToHouses` builds house ids via `resolveBuildingId`.
- Legacy Dexie rows used `name` as the full published id (`House-Purple-3-7`).
- Heuristic treated `name` as a *type* and appended `x-y` → ghost id `House-Purple-3-7-3-7`.
- `findById` missed every house → `nothing_distributed` (was mostly silent).

**Fix**
- Prefer published-looking `name` / `id` / `buildingId` before reconstructing `${type}-${x}-${y}` (`resolveBuildingId.js`).
- Log all non-success distribute reasons from `FoodDistributionService`.
- Regression test: legacy-shaped refs without `id`.

**Debt**
- Identity shim remains — see `refactor.md` (Building identity).
