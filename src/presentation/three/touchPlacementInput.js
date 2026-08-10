/**
 * Touch-first placement (rotation step before confirm) — not for desktop mouse/trackpad.
 */
export function prefersTouchPlacementFlow() {
  const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? false;
  const hoverCapable = window.matchMedia?.('(hover: hover)').matches ?? false;
  if (finePointer && hoverCapable) {
    return false;
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (coarsePointer) {
    return true;
  }

  const compactViewport = window.matchMedia?.('(max-width: 1024px)').matches ?? false;
  const noHover = window.matchMedia?.('(hover: none)').matches ?? false;
  return compactViewport && noHover;
}
