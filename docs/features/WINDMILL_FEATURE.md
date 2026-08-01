# Windmill Feature Documentation

## Overview
The windmill is an industry building that collects leftover food from all farms every **December**, after markets have finished buying in autumn (Sept–Nov).

> Note: older drafts said October; runtime and Supply BC use **December** (`monthIndex === 11`).

## Functionality

### Collection Behavior
- **When**: Every December (month index 11)
- **What**: Collects available food (wheat, carrot, cabbage) from farms
- **From Where**: ALL farms in the game (no distance restriction)
- **Requirements**: 
  - Windmill must have road access
  - Windmill must have workers when `worker_need > 0`
  - Farms must have road access
  - Farms must have available stocks

### Key Differences from Market
| Feature | Market | Windmill |
|---------|--------|----------|
| Collection Time | Autumn (Sept-Oct-Nov) | December only |
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
WindmillService.simulate(city, time)
  ↓
  Check if December
  ↓
  Find all windmills + farms
  ↓
  For each windmill with road access + workers:
    ↓
    supply.collectFromAllFarms(windmillId, allFarms, 'december')
      ↓
      For each farm with road access:
        ↓
        Take available crop (capacity-capped)
        ↓
      Facade: salesToWindmill / soldToWindmill / lastCollection
```

### Data Flow

1. **December arrives** (time simulation)
2. **WindmillService.simulate()** is called by game loop
3. **Service checks** all windmills for road access / workers
4. **For each valid windmill**:
   - Supply BC `WindmillCollectsFromAllFarms` iterates ALL farms
   - Checks each farm for road access
   - Collects available food stocks
   - Facade updates sales flags / lastCollection
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
- Collecte: Chaque décembre
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
   - Advance time to December
   - Check windmill stocks (should increase)
   - Check farm stocks (should decrease)
   - Click on windmill to see info panel
   - Console: `Collection via Supply BC`

3. **Edge Cases**:
   - Windmill without road access (should not collect)
   - Farms without road access (should be skipped)
   - Multiple windmills (each collects from all farms)
   - No farms present (windmill stocks remain unchanged)

## Console Logging

The WindmillService provides detailed console logging:

```
[WindmillService] Collection via Supply BC: { windmillId, totalBaskets, transfers }
[WindmillService] Collection skipped: { windmillId, reason, month }
```

## Future Enhancements

Possible improvements:
- Add windmill capacity limits
- Implement flour production from wheat
- Add distribution to bakeries
- Visual indicators for collection activity
- Statistics tracking for collected food
- Integration with food traceability system

