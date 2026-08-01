# Shared Kernel — Building catalog

**Source de vérité** pour le prix / catégorie / `gridSize` des assets constructibles, et pour les listes de types (maisons, fermes, …).

| Export | Rôle |
|---|---|
| `assetsPrices` | Coût, catégorie UI, empreinte |
| `houses`, `palaces`, `farms`, `commerce`, `factories` | Filtres tick / logique |
| `wantedHouses` | Variantes résidentielles (mesh loader) |
| `buildingsObjects` | Types ouvrant l’overlay info |

**Hors scope** (reste dans `presentation/three/meshs/data.js`) : `textures`, `meshNameMapping`.

Import direct depuis `shared/` (BC, presentation, ui). Pas besoin d’ACL pour de la data pure.
