# Module System Usage Examples

## Accès routier & identifiants (BC Urban)

```javascript
import { getOrCreateUrbanContext } from '../../composition/createUrbanContext.js';
import { hasRoadAccessFromCount } from '../../contexts/urban/domain/value-objects/RoadAccess.js';
import { toBuildingIdString } from '../../contexts/urban/domain/value-objects/BuildingId.js';
import { setupRoadAccessIcons } from '../../infrastructure/roadAccessIcons.js';

const urban = getOrCreateUrbanContext(housesStore);

// Identifiant IndexedDB (remplace makeDbItemId)
const id = toBuildingIdString('House-Blue', x, y); // "House-Blue-3-7" | null

// Services / UI : champ `roads` en base
if (hasRoadAccessFromCount(building.roads)) { /* ... */ }

// Panneau info
const { hasAccess, roadCount } = await urban.getRoadAccess(id);

// Rendu 3D : icône no-road
const syncRoadAccess = setupRoadAccessIcons(urban, { assetManager, textures });
await syncRoadAccess({ buildingId: id, mesh, position, scale });
```

## Nourriture (ModuleHelper)

```javascript
import { checkFoodAvailability } from './modules/ModuleHelper.js';

const { hasFood, totalFood } = checkFoodAvailability(stocks, population);
```

## Migration modules

- ✅ Accès routier → `contexts/urban/`
- ✅ Identifiants → `toBuildingIdString` / `BuildingId` (plus de `makeDbItemId`)
- FoodModule, EmploymentModule → modules legacy (à migrer plus tard)
