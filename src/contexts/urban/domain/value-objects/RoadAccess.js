export function createRoadAccess(roadCount) {
  const count = Number.isInteger(roadCount) && roadCount >= 0 ? roadCount : 0;
  return Object.freeze({
    roadCount: count,
    hasAccess: count > 0,
  });
}

export function roadAccessEquals(a, b) {
  return a.roadCount === b.roadCount && a.hasAccess === b.hasAccess;
}
