# Module System Usage Examples

## Non-Invasive Integration

The module system can be used **alongside existing code** without breaking anything. Here are examples:

### Example 1: Standalone Helper Function (Easiest)

Replace inline road access checks with the helper:

**Before:**
```javascript
const isRoad = marketNeighbors.filter(neighbor => neighbor.name === 'roads').length;
const hasRoadAccess = isRoad > 0;
```

**After (using module helper):**
```javascript
import { checkRoadAccess } from './modules/ModuleHelper.js';

const { hasAccess, roadCount } = checkRoadAccess(marketNeighbors);
const hasRoadAccess = hasAccess;
// roadCount is also available if needed
```

### Example 2: Attach Module to Building (Whole Building Benefits)

**In scene.js update loop:**
```javascript
import { getOrCreateRoadAccessModule } from './modules/ModuleHelper.js';

// For a building at buildings[x][y]:
const building = buildings[x][y];
const neighbors = await housesStore.getHouseItem(uniqueId, 'neighbors');

// Get or create module (creates once, reuses after)
const roadAccess = getOrCreateRoadAccessModule(building, neighbors);

// Now you can use:
if (roadAccess.value) {
    // Building has road access
    assetManager.setStatusSprite(building, textures['no-roads'], 'no-road', ...);
} else {
    // No road access
    assetManager.setStatusSprite(building, sentence['no-roads'], 'no-road', ...);
}

// Update roads count in DB if needed
await housesStore.updateHouseFields(uniqueId, {roads: roadAccess.getRoadCount()});

// Use module's toHTML() for info panels
const html = roadAccess.toHTML(); // "Road Access: Yes (2 roads)"
```

### Example 3: Gradual Migration Strategy

1. **Phase 1:** Use standalone helper in new code
2. **Phase 2:** Replace existing checks with helper
3. **Phase 3:** Attach modules to buildings for persistent state
4. **Phase 4:** Full integration with building lifecycle

### Benefits

- ✅ **Non-breaking:** Existing code continues to work
- ✅ **Gradual:** Can adopt module-by-module
- ✅ **Testable:** Modules can be tested independently
- ✅ **Extensible:** Easy to add new modules (FoodModule, PowerModule, etc.)

