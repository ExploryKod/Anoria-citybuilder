# Plan — the house levels, water, energy, and the toolbar by social class

Decided 2026-10-11. The old ladder is replaced, and what nothing reuses is thrown away (the Chapel and the faith need, entirely).
Reading of the design: a level's list is what a house AT that level needs to evolve to the next one, and the skills of a level
are granted when the house is at it, one level ahead of the buildings they staff (the convention the catalog already follows).

## 1. The ladder

| House at level | Needs met to evolve | Skills granted at this level (to staff the buildings of the next list) |
|---|---|---|
| **1** (cabane, free start) | food (a market reaches it) · **water** (a tank distributes it) · dispensary coverage | artisans: farmer · merchants: food sale, food storage · savants: water, medicine (the dispensary) |
| **2** | one type of consumption good · **fire** coverage (the fire station) · access to a warehouse (their activity draws on it) · **energy** (a plant distributes it) | artisans: three industry chains (raw material + finished product) and **energy** · merchants: handling (warehouses, the trade warehouse) and finance · savants: **fire** |
| **3** | two types of good · hospital coverage · **police** coverage · café-restaurant coverage | artisans: the other industry chains · merchants: hospitality (café-restaurant) · savants: hospital, **police** |
| **4, 5, 6** | what the old ladder kept for later (public bath, school, library, theatre, cinema, more goods), to be redesigned | the skills those buildings need |

Energy is a house need from level 2 (my addition: your list did not place it, only that it matters). Moving it is one line in the catalog.
Levels 4 to 6 are placeholders made of the old services so that nothing is thrown away that a later level can reuse.

## 2. New and removed

- **Removed completely:** the Chapel (and its legacy alias), the faith need and its requirement, the `spiritual` skill.
- **Water:** a new need of every house, like faith was (a quantity drained monthly, refilled by a building that distributes it). The water tank holds a monthly capacity of 480 m³ (4 m³ a citizen), drawn from the land's groundwater. A unit of water is a cubic metre and a unit of energy a megawatt-hour because the supply moves one unit at a time, like a basket of food: litres would write a database row per litre. Aquifer as a depleting reserve of the map is a later step; for now the tank's capacity is the limit.
- **Energy:** a new need of every house. Two plants make it, one from coal, one from petrol (imported goods held in the trade warehouse), and distribute it to the houses they reach if they have enough fuel. Factories needing energy too is a later note (not done).
- **New buildings:** water tank, fire station, police station, coal power plant, petrol power plant. The café-restaurant is the former Taverne, renamed.
- **New skills:** water, fire, police, energy.

## 3. The toolbar by social class

Each carousel pill is tied to a social class, derived from the catalog (the class whose houses grant the skill that staffs the building), and the houses have their own pill for the three classes. Buildings of the same chain (raw material → finished product, the energy plants together) stay grouped and are set apart by more space than other buildings, as today.

## 4. Status (2026-10-11): steps 1 to 6 built, not yet played

Built: water (the `water` need of every house, the `WaterTank` building, the `hydraulique` skill) in place of faith and the Chapel, which are gone
(the building, its legacy alias, the faith category, its requirement, the `spiritual` skill; the prefab's Chapel is a water tank); the new ladder in
`socialCategoryCatalog.js`; the requirement kinds `activityAccess` (a warehouse within reach of the house's business, checked through Supply's
`DescribeActivitySupplyAccess`) and `goodsVariety` with its own `outcomeField`; the need outcomes handed to the level policy as one `outcomes` record
(`lastWaterConsumption`, `lastEnergyConsumption`, `lastGoodsConsumption`); `FireStation`, `PoliceStation`, the café-restaurant (the Taverne, id `Pub`
kept); the energy need and the `CoalPlant` / `PetrolPlant` (4 coal or 2 petrol drawn from the trade warehouse for 120 MWh a month, 1 MWh a citizen);
the new skills (`hydraulique`, `energie`, `incendie`, `securite`); the toolbar pills by social class (`toolbarGroupOf`: a workplace is listed under the
class that grants the skill it requires; the three class pills replace Agriculture, Usines, Entrepôts and Services publics, and the houses keep one pill).
The starter prefab starts at level 1 (houses of at most 6 inhabitants, the water tank in place of the Chapel, no dispensary yet).

Known limits:
- A tank's water, a plant's energy and the fire/police cover are placeholders in size (flat capacities, not derived from staffing); the groundwater is not a depleting reserve of the map yet.
- Water and energy are `service` categories of the catalog like the old faith was: they show under the house's "Services" need in the Ressources tab, not as needs of their own.
- Energy is required from level 2 to 3 (my addition); factories needing energy are a later step, not done.
- A plant resells to nobody at its own cost: the energy plants buy their fuel from the trade warehouse at the value chain's hub price, below what the merchants paid for it landed; the price chain of phases 2 and 3 of `PLAN_IMPORTS_PRICES_CAPITAL.md` settles that.
- Levels 4 to 6 are placeholders made of the old services (public bath, school, theatre, cinema, library) and more goods.

## 5. Steps

1. Water tank in place of the Chapel; water in place of faith (same mechanism). Tests green.
2. The new ladder, new requirement kinds (goods kinds, warehouse access), generalised need outcomes in the house level policy.
3. Fire station, police station, café-restaurant, the new skills.
4. Energy: need, two plants, the fuel drawn from the trade warehouse.
5. The toolbar by social class.
6. Prefab, docs, tests, the tutorial text.
