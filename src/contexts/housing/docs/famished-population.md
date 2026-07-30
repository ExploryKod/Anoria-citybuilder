# Famished population (H4)

City metric: **how many residents are not fed from food stored at their house**.

## Owner

**Housing BC** — query `GetFamishedPopulation`, policy `FamishedPopulationPolicy`.

This is a **residential welfare** read model, not a Supply or Employment concept.

## Upstream / downstream

| Data | Writer | Reader (H4) |
|---|---|---|
| `pop` | Housing (growth, evolution) | Housing query |
| `stocks.food` | Supply (harvest, market, consumption, …) | Housing query (read-only) |

Housing does **not** import `contexts/supply/domain/**`. It reads persisted fields on the shared Dexie `houses` row via `DexieHousingBuildingRepository`.

Supply does **not** compute famished counts.

## Formula (v1)

Per **residential** house (Blue, Red, Purple, Palace):

```
fedAtHouse   = min(pop, stocks.food)
famishedHouse = pop − fedAtHouse   (≥ 0)
```

City:

```
totalPopulation    = Σ pop
fedPopulation      = Σ fedAtHouse
famishedPopulation = totalPopulation − fedPopulation
```

Uses `stocks.food` only (same as legacy `HousesStore.getFamishedPopulation`). Supply keeps `food` in sync with crop baskets on write.

## Not the same as evolution “hunger”

| Metric | Rule | Used for |
|---|---|---|
| **Famished (H4)** | `stocks.food` vs `pop` at home | Status bar, UI |
| **Purple evolution** | `totalFood >= pop` via `FoodAffluencePolicy` | House tier upgrade |

Evolution may use crop sum when `food` is unset; famished deliberately follows persisted `food` for UI parity with legacy.

## ACL

Legacy UI: `getOrCreateHousingContext().getFamishedPopulation()`.

`HousesStore.getFamishedPopulation()` delegates to Housing (deprecated facade).

## Tests

`tests/contexts/housing/famishedPopulation.behavior.test.js`
