# Windmill Feature Documentation

## Overview
The windmill is a new industry building that collects food from all farms in the game every October, similar to how markets collect food from nearby farms in autumn.

## Functionality

### Collection Behavior
- **When**: Every October (month index 9)
- **What**: Collects all available food (wheat, carrot, cabbage) from farms
- **From Where**: ALL farms in the game (no distance restriction)
- **Requirements**: 
  - Windmill must have road access
  - Farms must have road access
  - Farms must have available stocks

### Key Differences from Market
| Feature | Market | Windmill |
|---------|--------|----------|
| Collection Time | Autumn (Sept-Oct-Nov) | October only |
| Collection Range | Nearby farms only | ALL farms in game |
| Distribution | Distributes to houses | Stores only (no distribution) |
| Distance Condition | Yes (neighbors) | No (all farms) |

## Implementation Details

### Files Modified/Created

1. **WindmillService.js** (NEW)
   - Location: `src/js/game/services/WindmillService.js`
   - Extends: `SimService`
   - Purpose: Manages windmill food collection from all farms

2. **game.js** (MODIFIED)
   - Added WindmillService import and initialization
   - Added windmill info panel display with:
     - Stock display (wheat, carrot, cabbage, total)
     - Functionality description
     - Collection timing info

### Service Architecture

The WindmillService follows the same pattern as FoodDistributionService:

```javascript
WindmillService.simulate(city, housesStore, time)
  ↓
  Check if October
  ↓
  Find all windmills
  ↓
  Find all farms
  ↓
  For each windmill with road access:
    ↓
    collectFoodFromFarms(windmill, allFarms, housesStore, time)
      ↓
      For each farm with road access:
        ↓
        Take all available stocks (wheat/carrot/cabbage)
        ↓
        Update farm stocks to 0
        ↓
        Add to windmill stocks
```

### Data Flow

1. **October arrives** (time simulation)
2. **WindmillService.simulate()** is called by game loop
3. **Service checks** all windmills for road access
4. **For each valid windmill**:
   - Iterates through ALL farms in the game
   - Checks each farm for road access
   - Collects available food stocks
   - Updates IndexedDB for both farm and windmill
5. **Info panel** reads stocks directly from IndexedDB when clicked

### IndexedDB Structure

Windmill stocks are stored in the same format as houses and markets:

```javascript
{
  id: "Windmill-001_x_y",
  type: "Windmill-001",
  x: 10,
  y: 15,
  stocks: {
    wheat: 150,
    carrot: 100,
    cabbage: 80,
    food: 330  // Total
  },
  neighbors: [...],
  roads: 1
}
```

## Info Panel Display

When clicking on a windmill, the info panel shows:

### Stock Section
- Blé (Wheat): X paniers
- Légumes verts (Cabbage): X paniers
- Autres légumes (Carrot): X paniers
- Total: X paniers collectés

### Functionality Section
- Collecte: Chaque octobre
- Source: Toutes les fermes du jeu
- Condition: Accès routier requis

## Testing

To test the windmill functionality:

1. **Setup**:
   - Place several farms (wheat, carrot, cabbage)
   - Ensure farms have road access
   - Place a windmill with road access
   - Wait for farms to produce (autumn harvest)

2. **Verification**:
   - Advance time to October
   - Check windmill stocks (should increase)
   - Check farm stocks (should decrease to 0)
   - Click on windmill to see info panel

3. **Edge Cases**:
   - Windmill without road access (should not collect)
   - Farms without road access (should be skipped)
   - Multiple windmills (each collects from all farms)
   - No farms present (windmill stocks remain unchanged)

## Console Logging

The WindmillService provides detailed console logging:

```
[WindmillService] October detected - windmills collecting from farms
[WindmillService] Processing windmill: { windmillId, windmillType, totalFarms }
[WindmillService] Windmill road access check: { hasRoadAccess, roadCount }
[WindmillService] Processing farm: { farmId, farmType, stocks }
[WindmillService] Collected wheat from farm: { farmId, wheatCollected }
[WindmillService] Farm collection results: { wheatCount, carrotCount, cabbageCount }
[WindmillService] Windmill stocks after farm collection: { newStocks }
```

## Future Enhancements

Possible improvements:
- Add windmill capacity limits
- Implement flour production from wheat
- Add distribution to bakeries
- Visual indicators for collection activity
- Statistics tracking for collected food
- Integration with food traceability system

