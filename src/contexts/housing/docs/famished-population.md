# Famished population (H4)

City metric: **how many residents were not fed** (aligned with house Régime tab).

## Owner

**Housing BC** — query `GetFamishedPopulation`, policy `FamishedPopulationPolicy`.

## Formula

Per residential house:

1. **Primary** — `lastConsumption.totalUnfed` (same signal as « X habitants non nourris » in Régime)
2. **Fallback** (no consumption record yet) — `pop − edible baskets` from category stocks

City:

```
famishedPopulation = Σ famishedAtHouse
fedPopulation      = totalPopulation − famishedPopulation
```

## Not the same as pantry-only buffer

A house can show empty shelves *after* a successful meal, or show a stale `stocks.food`
aggregate. The HUD therefore follows **last consumption outcome**, not leftover pantry alone.
