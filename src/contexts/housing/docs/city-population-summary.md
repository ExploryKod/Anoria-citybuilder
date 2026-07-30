# City population summary (H6)

City metric: **total residents across residential houses**.

## Owner

**Housing BC** — query `GetCityPopulationSummary`.

## Formula (v1)

```
totalPop = Σ pop   (residential houses only: Blue, Red, Purple, Palace)
houseCount = number of residential rows
```

Non-residential buildings (farms, markets, …) are **excluded** even if they carry a `pop` field in Dexie.

## Legacy access

| Caller | Entry |
|---|---|
| `scene.js` | `housing.getCityPopulationSummary()` (injected context) |
| UI modules (work, commerce, budget) | `getCityTotalPopulation()` in `src/js/acl/housing.js` |

## vs Employment

Total `pop` is a **Housing** published fact. Worker/elite splits are **Employment** reads — see `employment/docs/boundaries.md`.
