# Employee System Documentation

## Overview
Every building in the game now has an `employees` object that tracks workforce requirements, costs, and priorities. This system enables future features like labor management, unemployment, and economic simulation.

## Employee Object Structure

Each building in IndexedDB has an `employees` object with the following properties:

```javascript
{
    priority: number,    // Hiring priority (0-10, higher = more important)
    worker: number,      // Number of regular workers required
    elite: number,       // Number of elite/specialized workers required
    category: number,    // Building category (see categories below)
    salary: number       // Total monthly salary cost
}
```

## Building Categories

Buildings are classified into categories that determine their default employee requirements:

| Category | Value | Description | Examples |
|----------|-------|-------------|----------|
| RESIDENTIAL | 0 | Housing for citizens | House-Blue, House-Red, House-Purple, House-2Story |
| COMMERCIAL | 1 | Trade and commerce | Market-Stall |
| INDUSTRIAL | 2 | Production buildings | Farm-Wheat, Farm-Carrot, Farm-Cabbage, Windmill-001, Barn-001 |
| INFRASTRUCTURE | 3 | City infrastructure | roads |
| PUBLIC | 4 | Public services | (future: schools, hospitals, temples) |
| OTHER | 5 | Uncategorized | Other building types |

## Default Employee Configurations

### Residential Buildings (Category 0)
- **Priority**: 0
- **Workers**: 0
- **Elite**: 0
- **Salary**: 0
- *Rationale*: Residential buildings house citizens, they don't require employees

### Commercial Buildings (Category 1)
**Market-Stall:**
- **Priority**: 7
- **Workers**: 2
- **Elite**: 1
- **Salary**: 30 (2×10 + 1×10)
- *Rationale*: Markets need workers to manage inventory and elite staff for operations

### Industrial Buildings (Category 2)

**Farms (Wheat/Carrot/Cabbage):**
- **Priority**: 8
- **Workers**: 3
- **Elite**: 0
- **Salary**: 30 (3×10)
- *Rationale*: Farms are labor-intensive and critical for food production

**Windmill:**
- **Priority**: 6
- **Workers**: 2
- **Elite**: 1
- **Salary**: 30 (2×10 + 1×10)
- *Rationale*: Windmills need workers for operations and an elite miller

**Barn:**
- **Priority**: 5
- **Workers**: 1
- **Elite**: 0
- **Salary**: 10 (1×10)
- *Rationale*: Barns need minimal staff for storage management

### Infrastructure Buildings (Category 3)
**Roads:**
- **Priority**: 3
- **Workers**: 0
- **Elite**: 0
- **Salary**: 0
- *Rationale*: Roads don't require active staff (maintenance handled separately)

### Public Buildings (Category 4)
**Future buildings (schools, hospitals, temples):**
- **Priority**: 9
- **Workers**: 3
- **Elite**: 2
- **Salary**: 50 (3×10 + 2×10)
- *Rationale*: Public services are high priority and require specialized staff

## Implementation Details

### New Building Creation
When a new building is placed, the `employees` object is automatically added based on the building type:

```javascript
// In game.js
const dbHouseData = {
    name: houseID,
    type: activeToolId,
    // ... other properties ...
    employees: getDefaultEmployees(activeToolId)
}
```

### Existing Building Migration
The system automatically adds the `employees` object to existing buildings that don't have one:

```javascript
// In scene.js update loop
const buildingData = await housesStore.getHouse(currentUniqueID);
if (buildingData && !buildingData.employees) {
    const defaultEmployees = getDefaultEmployees(currentBuildingId);
    await housesStore.updateHouseFields(currentUniqueID, { employees: defaultEmployees });
}
```

This migration runs during the scene update loop, ensuring all buildings eventually have employee data without requiring a database reset.

## Helper Functions

### `getDefaultEmployees(buildingType)`
Returns the default employee configuration for a building type.

**Parameters:**
- `buildingType` (string): Building type ID (e.g., 'House-Blue', 'Market-Stall', 'Farm-Wheat')

**Returns:**
- Object with properties: `priority`, `worker`, `elite`, `category`, `salary`

**Example:**
```javascript
const employees = getDefaultEmployees('Market-Stall');
// Returns: { priority: 7, worker: 2, elite: 1, category: 1, salary: 30 }
```

### `getBuildingCategory(buildingType)`
Determines the category of a building based on its type.

**Parameters:**
- `buildingType` (string): Building type ID

**Returns:**
- Number representing the building category (0-5)

### `calculateSalary(employees, workerSalary, eliteSalary)`
Calculates total salary cost for employees.

**Parameters:**
- `employees` (Object): Employees object
- `workerSalary` (number): Salary per worker (default: 10)
- `eliteSalary` (number): Salary per elite (default: 10)

**Returns:**
- Number representing total salary cost

**Example:**
```javascript
const salary = calculateSalary({ worker: 2, elite: 1 }, 10, 10);
// Returns: 30
```

### `updateEmployeeSalary(employees, workerSalary, eliteSalary)`
Updates the salary field in an employees object based on worker/elite counts.

**Parameters:**
- `employees` (Object): Employees object to update
- `workerSalary` (number): Salary per worker (default: 10)
- `eliteSalary` (number): Salary per elite (default: 10)

**Returns:**
- Updated employees object with recalculated salary

## Future Enhancements

This employee system lays the groundwork for several future features:

1. **Labor Market**
   - Track available workers in the city
   - Unemployment rate
   - Wage inflation based on labor demand

2. **Building Efficiency**
   - Buildings without enough employees operate at reduced efficiency
   - Overstaffed buildings waste resources

3. **Economic Simulation**
   - Salary expenses affect city budget
   - Workers pay taxes based on their income
   - Elite workers require higher education (future public buildings)

4. **Priority System**
   - During labor shortages, high-priority buildings get workers first
   - Player can adjust priorities manually

5. **Worker Migration**
   - Workers move between buildings based on salary and conditions
   - Residential buildings need to be near workplaces

## Example Building Data

Here's what a complete building object looks like in IndexedDB:

```javascript
{
    name: 'Windmill-001-5-5',
    type: 'Windmill-001',
    neighbors: [],
    pop: 0,
    stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
    gameTurn: 0,
    time: 0,
    isBuilding: true,
    isCollecting: false,
    roads: 0,
    stage: 0,
    stageName: '',
    price: 50,
    cityFunds: 500,
    maintenance: 0,
    worldTime: 2,
    x: 5,
    y: 5,
    employees: {
        priority: 6,
        worker: 2,
        elite: 1,
        category: 2,
        salary: 30
    }
}
```

## Files Modified

1. **EmployeeHelper.js** (NEW)
   - Location: `src/js/game/modules/EmployeeHelper.js`
   - Contains all employee-related helper functions and constants

2. **game.js** (MODIFIED)
   - Added `getDefaultEmployees` import
   - Added `employees` property to new building creation

3. **scene.js** (MODIFIED)
   - Added `getDefaultEmployees` import
   - Added migration logic to add employees to existing buildings

## Testing

To verify the employee system is working:

1. **Create a new building**
   - Place any building type
   - Check IndexedDB to verify `employees` object exists
   - Verify values match the expected defaults for that building type

2. **Check existing buildings**
   - Load a save with existing buildings
   - Wait for one game tick
   - Check IndexedDB to verify all buildings now have `employees` object

3. **Verify categories**
   - Check that residential buildings have 0 workers
   - Check that farms have 3 workers
   - Check that markets have 2 workers + 1 elite

## Notes

- The salary calculation uses a default of 10 per worker/elite, but this can be adjusted in future updates
- Priority values are suggestions and can be modified based on gameplay balance
- The migration is non-destructive and only adds the `employees` object if it's missing
- All buildings get employee data, even roads (with 0 employees), for consistency

