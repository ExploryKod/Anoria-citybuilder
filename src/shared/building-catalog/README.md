# Shared Kernel — Building catalog

**Source de vérité** pour les faits statiques et déclaratifs par type de bâtiment (prix, catégorie, empreinte, secteur d’emploi, maintenance, nom affiché), et pour les listes de types (maisons, fermes, …).

| Export | Fichier | Rôle |
|---|---|---|
| `buildingCatalog` | `buildingCatalog.js` | **Fichier central** — un objet par type, sections par bounded context (`construction`, `employment`, `accounting`, `displayName`) |
| `assetsPrices` | `assetsPrices.js` | Dérivé de `buildingCatalog` — coût, catégorie UI, empreinte |
| `houses`, `palaces`, `farms`, `commerce`, `factories` | `buildingCategories.js` | Filtres tick / logique |
| `wantedHouses` | `buildingCategories.js` | Variantes résidentielles (mesh loader) |
| `buildingsObjects` | `buildingCategories.js` | Types ouvrant l’overlay info |

## `buildingCatalog.js` — règles

- **Données uniquement.** Aucune fonction de calcul/décision, aucun import depuis un bounded context (`src/contexts/**`).
- **Aucun comportement.** Les règles d’évolution des maisons, l’accès route, les flux supply, etc. restent dans leur BC (ex. `housing/domain/policies/HouseEvolutionPolicy.js`). Ce fichier ne décide jamais *ce qui se passe*, seulement *ce qui est vrai*.
- **Un champ n’est ajouté que s’il est réellement dupliqué** entre ≥2 consommateurs aujourd’hui (pas de modélisation anticipée — pas de section « dependencies » tant qu’un fait dupliqué concret ne le justifie pas).

Chaque BC garde son propre fichier d’accès (`EmploymentSectorCatalog.js`, `BuildingMaintenanceBreakdownPolicy.js`, `HouseTypeCatalog.js`, `BuildingNotifications.js`) qui **dérive** ses exports de `buildingCatalog` — les signatures/exports publics ne changent pas. Le reste du code continue de passer par ces accesseurs BC, pas par `buildingCatalog` directement : un seul point d’édition (ce fichier), frontières BC préservées.

**Hors scope** (reste dans `presentation/three/meshs/data.js`) : `textures`, `meshNameMapping` — trop lié au parsing GLB (variantes many-to-one) pour être consolidé sans risque.

Import direct depuis `shared/` (BC, presentation, ui). Pas besoin d’ACL pour de la data pure.
