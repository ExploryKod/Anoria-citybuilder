/**
 * The human development index of a hamlet, declared once: three dimensions, each a mean of shares read in the game, and the goalposts of the income. The game has no life expectancy
 * or years of schooling, so each dimension is told by what the game does have:
 *   - **health**: the share of the inhabitants who are fed (not in disette, pénurie or famine) and the share who live in a house a doctor or a hospital serves;
 *   - **education**: the share of the inhabitants whose house a primary school serves, the share a school serves, and the share a library serves;
 *   - **income**: the domestic product in purchasing power parity per inhabitant, on a logarithmic scale between two goalposts (the same shape as the United Nations').
 * A service counts for a house when its coverage flag is fresh (the same window as the tiers' requirements, SERVICE_COVERAGE_PERIODS). The index is the geometric mean of the three.
 * First values, to tune with a play-through.
 */
export const DEVELOPMENT_DIMENSIONS = Object.freeze({
  health: Object.freeze({ label: 'Santé', fed: true, serviceGroups: Object.freeze([Object.freeze(['doctor', 'hospital'])]) }),
  education: Object.freeze({ label: 'Éducation', fed: false, serviceGroups: Object.freeze([Object.freeze(['primarySchool']), Object.freeze(['school']), Object.freeze(['library'])]) }),
});

/**
 * The income index runs from 0 at `min` to 1 at `max`, in euros per inhabitant and per year, on a logarithmic scale. They are set on the economy's own scale (a citizen's needs cost about
 * 70 a year, a worker is paid about 100 a year and only some of the inhabitants work): the lower goalpost is well under that, so that a hamlet that starts out is above it, as the United
 * Nations' is under any real subsistence; the upper one is a prosperous hamlet. First values, to tune with a play-through.
 */
export const INCOME_GOALPOSTS = Object.freeze({ min: 3, max: 250 });
