/**
 * How long a construction lasts before it is worth nothing in the books, in years, per family of building (the family of its upkeep, see
 * `maintenanceCategoryOf`). The owner's property company depreciates each building it holds in a straight line: its cost over this many years, one
 * dotation a month from the month after it was built. A family of building that is kept up but has no life declared here is an error: its
 * depreciation could not be written. First values, to tune with a play-through.
 */
export const DEPRECIATION_YEARS = Object.freeze({
  houses: 30,
  farms: 20,
  markets: 20,
  industry: 25,
});
