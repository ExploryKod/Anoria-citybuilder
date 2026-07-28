export function createRoadAccess(roadCount) {
  const count = Number.isInteger(roadCount) && roadCount >= 0 ? roadCount : 0;
  return Object.freeze({
    roadCount: count,
    hasAccess: count > 0,
  });
}

/** Lit hasAccess depuis le champ `roads` persisté (IndexedDB). */
export function hasRoadAccessFromCount(roadCount) {
  return createRoadAccess(roadCount ?? 0).hasAccess;
}

export function roadAccessEquals(a, b) {
  return a.roadCount === b.roadCount && a.hasAccess === b.hasAccess;
}
