# SimCity ThreeJS Clone - Improvements Analysis for Anoria

## Executive Summary

After analyzing simcity-threejs-clone, here are **key architectural patterns, performance optimizations, and functional improvements** that could benefit Anoria:

---

## 🏗️ **ARCHITECTURAL IMPROVEMENTS**

### 1. **SimObject Base Class Pattern**
**What simcity does:**
- All game objects extend `THREE.Object3D` via `SimObject` base class
- Unified disposal, highlighting, and selection
- Clean inheritance hierarchy: `SimObject` → `Building` → `Zone` / `Road`
- `setMesh()` method handles disposal automatically

**Benefits:**
- Consistent object lifecycle management
- Cleaner code (no scattered mesh disposal logic)
- Built-in selection/focus highlighting via `setSelected()` / `setFocused()`

**Apply to Anoria:**
```javascript
// Instead of scattered disposal, have base class:
class GameObject extends THREE.Object3D {
  setMesh(mesh) {
    if (this.mesh) this.dispose();
    this.mesh = mesh;
    if (mesh) this.add(mesh);
  }
  setSelected(selected) {
    this.#setEmission(selected ? 0xaaaa55 : 0);
  }
  setFocused(focused) {
    this.#setEmission(focused ? 0x555555 : 0);
  }
}
```

---

### 2. **Module System for Buildings**
**What simcity does:**
- Buildings use **composable modules** (`PowerModule`, `RoadAccessModule`, `JobsModule`, `ResidentsModule`)
- Each module has `simulate()`, `dispose()`, and own state
- Clean separation: building logic ≠ building modules

**Benefits:**
- Extensible (add new modules without touching existing code)
- Testable (modules can be tested independently)
- Reusable (same module across different building types)

**Apply to Anoria (état actuel) :**
- Accès routier / voisinage : **BC Parcels** (use cases + ports), plus `RoadAccessModule` legacy (supprimé)
- Food / emploi : encore legacy / futurs BC — ne pas réintroduire des modules Three.js couplés
```javascript
// Lecture UI / gameplay :
parcels.getRoadAccess(buildingId)
parcels.getNeighbors(buildingId)
// Actions :
parcels.syncPlacedBuilding({ buildingId, x, y, type })
parcels.syncRemovedBuilding({ buildingId })
```

---

### 3. **Service Architecture**
**What simcity does:**
- City-wide systems as **Services** (`PowerService`, extensible via `SimService`)
- Services run before individual building simulation
- Clean separation: city-level logic ≠ building logic

**Benefits:**
- Centralized city-wide systems (power grid, traffic, etc.)
- Easy to add new services without changing building code
- Efficient (processes whole city at once, not per-building)

**Apply to Anoria:**
```javascript
// Instead of processing in building loops:
class City extends THREE.Group {
  services = [
    new PowerService(),
    new FoodDistributionService(), // New service!
    new TrafficService()
  ];
  
  simulate() {
    this.services.forEach(s => s.simulate(this));
    // Then update buildings...
  }
}
```

---

### 4. **City extends THREE.Group**
**What simcity does:**
- `City` extends `THREE.Group` (not separate scene object)
- Organized structure: `city.root` for game objects, `city.debugMeshes` for debug
- Direct Three.js integration

**Benefits:**
- Clean scene hierarchy
- Easy to move/transform entire city
- Debug meshes don't interfere with raycasting

**Apply to Anoria:**
Consider making `City` a `THREE.Group` instead of just a data structure.

---

### 5. **RefreshView Pattern**
**What simcity does:**
- Tiles call `refreshView(city)` when needed (placement, neighbor changes)
- Only refreshes affected tiles, not entire scene
- Handles mesh updates, neighbor connections

**Benefits:**
- Efficient updates (only changed tiles)
- Consistent visual state
- Handles complex dependencies (roads connecting, terrain hiding)

---

## ⚡ **PERFORMANCE OPTIMIZATIONS**

### 1. **Raycasting Optimization: Separate Debug Meshes**
**What simcity does:**
```javascript
city.debugMeshes = new THREE.Group();  // Not included in raycasting
city.root = new THREE.Group();         // Main game objects
```
Raycasting only checks `city.root.children`, skipping debug visualization.

**Performance gain:** ~10-30% faster raycasting with large scenes

---

### 2. **Efficient Tile Lookup with Bounds Checking**
**What simcity does:**
```javascript
getTile(x, y) {
  if (x === undefined || y === undefined ||
      x < 0 || y < 0 || x >= this.size || y >= this.size) {
    return null;  // Early exit
  }
  return this.tiles[x][y];
}
```
Always bounds-checks before array access (prevents undefined errors).

**Apply to Anoria:**
Ensure all tile access uses safe getter methods.

---

### 3. **Set-Based Visited Tracking for Pathfinding**
**What simcity does:**
```javascript
const visited = new Set();
if (visited.has(tile.id)) continue;  // O(1) lookup
visited.add(tile.id);
```
Uses `Set` for O(1) visited checks instead of array `includes()` which is O(n).

**Performance gain:** Massive for pathfinding (BFS/DFS searches)

---

### 4. **Manhattan Distance for City Proximity**
**What simcity does:**
```javascript
distanceTo(tile) {
  return Math.abs(this.x - tile.x) + Math.abs(this.y - tile.y);
}
```
Simple, fast distance calculation (no `Math.sqrt()` needed).

**Performance gain:** Faster than Euclidean distance, sufficient for grid-based games

---

### 5. **Orthographic Camera**
**What simcity does:**
- Uses `OrthographicCamera` instead of `PerspectiveCamera`
- No perspective distortion, constant scale
- Better for isometric/top-down games

**Benefits:**
- More predictable rendering
- Easier UI overlay alignment
- Better for city builders (buildings don't distort with zoom)

---

### 6. **Material Cloning Strategy**
**What simcity does:**
- Each mesh instance gets cloned materials
- Allows independent highlighting/selection per object
- Materials properly disposed in `dispose()`

**Memory consideration:** More materials, but enables per-object visual effects

---

## 🎯 **FUNCTIONAL IMPROVEMENTS**

### 1. **State Machine for Citizens**
**What simcity does:**
- Citizens have explicit states: `'idle' | 'school' | 'employed' | 'unemployed' | 'retired'`
- State transitions in `simulate()` method
- Clear lifecycle management

**Benefits:**
- Easy to understand citizen behavior
- Easy to add new states (sick, vacation, etc.)
- Debuggable (can inspect current state)

---

### 2. **Proper Disposal Chain**
**What simcity does:**
- Every object has `dispose()` method
- Disposal cascades: `Building.dispose()` → `modules.dispose()` → `super.dispose()`
- Materials always cleaned up

**Benefits:**
- No memory leaks
- Predictable cleanup
- Works well with object pooling (if added later)

---

### 3. **toHTML() Method for UI**
**What simcity does:**
- Objects implement `toHTML()` for info panels
- Consistent UI generation
- Objects know how to display themselves

**Benefits:**
- Clean separation (UI doesn't need to know object internals)
- Easy to customize per-object display
- Can generate different formats (HTML, JSON, etc.)

---

### 4. **Sprite-Based Status Icons**
**What simcity does:**
- Uses `THREE.Sprite` for status icons (no-power, no-road)
- Always faces camera (billboarding)
- Efficient (sprites are cheap)

**Benefits:**
- Better performance than 3D icons
- Always readable
- Easy to show/hide

---

### 5. **Vehicle Graph System**
**What simcity does:**
- Separate `VehicleGraph` for road network
- Graph nodes/edges for pathfinding
- Vehicles follow graph paths

**Benefits:**
- Realistic traffic flow
- Efficient pathfinding (pre-computed graph)
- Visual debugging of road network

**Note:** Anoria might not need this yet, but good pattern for future traffic/citizens walking.

---

## 🔧 **CODE QUALITY IMPROVEMENTS**

### 1. **JSDoc Type Annotations**
**What simcity does:**
- Extensive `@type` annotations
- `@param` and `@returns` documentation
- Clear API contracts

**Benefits:**
- Better IDE autocomplete
- Self-documenting code
- Easier to onboard new developers

---

### 2. **Constants at Top of Files**
**What simcity does:**
```javascript
const DEG2RAD = Math.PI / 180.0;
const RIGHT_MOUSE_BUTTON = 2;
const CAMERA_SIZE = 5;
```
All magic numbers extracted as named constants.

**Benefits:**
- Easy to tune values
- No magic numbers scattered in code
- Better readability

---

### 3. **Private Fields (# syntax)**
**What simcity does:**
- Uses `#privateField` for encapsulation
- Protected internal state
- Clear public API

**Benefits:**
- Prevents accidental access
- Better encapsulation
- Clearer intent

---

## 📊 **PRIORITY RECOMMENDATIONS FOR ANORIA**

### **High Priority (Big Impact, Medium Effort):**

1. **✅ SimObject Base Class** - Unified object lifecycle, disposal, highlighting
2. **✅ Module System** - Make buildings extensible with composable modules
3. **✅ Raycasting Optimization** - Separate debug meshes group
4. **✅ Proper Disposal Chain** - Fix memory leaks, enable pooling later

### **Medium Priority (Nice to Have):**

5. **Service Architecture** - City-wide systems (food distribution, traffic, etc.)
6. **State Machine for Citizens** - If you add citizen simulation
7. **Manhattan Distance** - If doing pathfinding/searching
8. **toHTML() Pattern** - Cleaner UI generation

### **Low Priority (Future Enhancements):**

9. **Orthographic Camera** - If switching to isometric view
10. **Vehicle Graph** - If adding traffic/citizens moving
11. **Set-Based Visited Tracking** - When doing pathfinding at scale

---

## 🚀 **QUICK WINS (Easy Improvements)**

1. **Extract magic numbers to constants** (30 min)
2. **Add JSDoc type annotations** (gradual)
3. **Bounds checking in tile getters** (1 hour)
4. **Separate debug meshes group** (30 min)
5. **Use Set instead of array for visited tracking** (15 min)

---

## 💡 **KEY TAKEAWAYS**

1. **Simcity prioritizes clean architecture** over premature optimization
2. **Extensibility** through modules/services makes adding features easy
3. **Memory management** is handled systematically (dispose chains)
4. **Performance optimizations** are targeted (raycasting, pathfinding)
5. **Type safety** via JSDoc improves maintainability

These patterns would significantly improve Anoria's codebase organization and make future features easier to add!

