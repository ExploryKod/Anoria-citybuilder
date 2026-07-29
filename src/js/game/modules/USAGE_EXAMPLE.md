# Module System Usage Examples

## Accès routier & identifiants (BC Parcels)

Passer **uniquement** par l'ACL — ne pas importer `contexts/parcels/domain/**` depuis le legacy :

```javascript
import {
  getOrCreateParcelsContext,
  hasRoadAccessFromCount,
  toBuildingIdString,
} from '../acl/parcels.js';
import { setupRoadAccessIcons } from '../acl/parcels.js';

const parcels = getOrCreateParcelsContext(housesStore);

const id = toBuildingIdString('House-Blue', x, y); // "House-Blue-3-7" | null

if (hasRoadAccessFromCount(building.roads)) { /* ... */ }

const { hasAccess, roadCount } = await parcels.getRoadAccess(id);

const syncRoadAccess = setupRoadAccessIcons(parcels, { assetManager, textures });
await syncRoadAccess({ buildingId: id, mesh, position, scale });
```

## Nourriture (Housing context)

```javascript
import { getOrCreateHousingContext } from '../acl/housing.js';

const housing = getOrCreateHousingContext(housesStore);
const { hasFood, totalFood } = housing.evaluateHouseFoodAffluence({ stocks, population });
```

## Migration modules

- ✅ Accès routier → `contexts/parcels/` via `src/js/acl/parcels.js`
- ✅ Identifiants → `toBuildingIdString` / `BuildingId`
- FoodModule, EmploymentModule → modules legacy (à migrer plus tard)
