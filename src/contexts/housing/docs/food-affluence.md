# Food affluence (H5)

Per-house read: **does stored food meet residential needs and evolution thresholds?**

## Owner

**Housing BC** — queries `EvaluateHouseFoodAffluence`, `PreviewHouseEvolution`; policy `FoodAffluencePolicy`.

Not a Supply concept: Supply does not compare stocks to `pop` or compute palace food goals.

## Upstream / downstream

| Data | Writer | Reader (H5) |
|---|---|---|
| `stocks.*` | Supply | Housing queries (read-only, in-memory or Dexie) |
| `pop` | Housing | Housing queries |

Legacy UI (`scene.js`, `game.js`) calls **`housing.evaluateHouseFoodAffluence(...)`** and **`housing.previewHouseEvolution(...)`** on the composition context — not `ModuleHelper`, not domain imports, not ACL policy re-exports.

## Queries

| Query | Use |
|---|---|
| `EvaluateHouseFoodAffluence` | no-food icon, decay hint, food totals in info panel |
| `PreviewHouseEvolution` | Purple / Palace conditions in info panel |

## vs famished (H4)

| | H4 famished | H5 affluence |
|---|---|---|
| Scope | city aggregate | one house |
| Food field | `stocks.food` only | `totalFoodFromStocks` (food or Σ crops) |
| Question | how many unfed residents? | enough for evolution / icons? |

See [`famished-population.md`](famished-population.md).
