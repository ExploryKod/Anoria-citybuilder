/**
 * What an inhabitant is drawn from on arrival: declared here, once. Each range is drawn uniformly, a single time, when the
 * citizen arrives (see `shared/citizens/Citizen.js`). The starting health is a state (it moves afterwards); the constitution
 * never changes for the rest of the citizen's life.
 *
 * The values are a first balance, meant to be tuned here and nowhere else.
 */
export const CITIZEN_ARRIVAL = Object.freeze({
  /** Health score (0-100) an arriving citizen starts from. */
  startingHealth: Object.freeze({ min: 55, max: 90 }),
  /** Mental-health score (0-100) an arriving citizen starts from: a state, like the health, that moves towards what his surroundings give. */
  startingMentalHealth: Object.freeze({ min: 60, max: 85 }),
  constitution: Object.freeze({
    /** Share of the gap to the environment level the health closes each month (0-1). */
    convergence: Object.freeze({ min: 0.1, max: 0.5 }),
    /** How strongly the factors of the environment weigh on this citizen (1 = the catalog's points as declared). */
    sensitivity: Object.freeze({ min: 0.5, max: 1.5 }),
  }),
});

export const HEALTH_MIN = 0;
export const HEALTH_MAX = 100;
