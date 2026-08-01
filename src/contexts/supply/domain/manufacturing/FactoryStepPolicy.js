/**
 * Factory turn state machine — one step per tick: collect → transform → produce.
 */

export function shouldRunCollectStep({
  time,
  lastCollectTurn = -1,
  lastProductionTurn = -1,
  lastTransformTurn = -1,
}) {
  if (lastCollectTurn >= time) return false;
  return (
    lastCollectTurn === -1 ||
    lastProductionTurn === time - 1 ||
    (lastCollectTurn < time - 2 && lastTransformTurn < time - 1)
  );
}

export function shouldRunTransformStep({
  time,
  lastCollectTurn = -1,
  lastTransformTurn = -1,
  stepExecuted = false,
}) {
  return !stepExecuted && lastCollectTurn === time - 1 && lastTransformTurn < time;
}

export function shouldRunProduceStep({
  time,
  lastTransformTurn = 0,
  lastProductionTurn = -1,
  stepExecuted = false,
}) {
  if (stepExecuted || lastTransformTurn <= 0 || lastProductionTurn >= time) {
    return false;
  }
  return time - lastTransformTurn >= 1;
}
