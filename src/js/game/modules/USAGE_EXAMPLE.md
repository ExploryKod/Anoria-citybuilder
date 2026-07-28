# Module System Usage Examples

## Accès routier & identifiants (BC Urban)

Passer **uniquement** par l'ACL — ne pas importer `contexts/urban/domain/**` depuis le legacy :

```javascript
import {
  getOrCreateUrbanContext,
  hasRoadAccessFromCount,
  toBuildingIdString,
} from '../acl/urban.js';
import { setupRoadAccessIcons } from '../../infrastructure/roadAccessIcons.js';

const urban = getOrCreateUrbanContext(housesStore);

const id = toBuildingIdString('House-Blue', x, y); // "House-Blue-3-7" | null

if (hasRoadAccessFromCount(building.roads)) { /* ... */ }

const { hasAccess, roadCount } = await urban.getRoadAccess(id);

const syncRoadAccess = setupRoadAccessIcons(urban, { assetManager, textures });
await syncRoadAccess({ buildingId: id, mesh, position, scale });
```

## Nourriture (ModuleHelper)

```javascript
import { checkFoodAvailability } from './modules/ModuleHelper.js';

const { hasFood, totalFood } = checkFoodAvailability(stocks, population);
```

## Migration modules

- ✅ Accès routier → `contexts/urban/` via `src/js/acl/urban.js`
- ✅ Identifiants → `toBuildingIdString` / `BuildingId`
- FoodModule, EmploymentModule → modules legacy (à migrer plus tard)
