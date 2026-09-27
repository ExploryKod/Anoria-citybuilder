import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const showInfoToast = jest.fn();

jest.unstable_mockModule('../../../src/presentation/dom/shell/ToastNotifier.js', () => ({
  showInfoToast,
  showWarningToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

const { showPlacementNeedsNotification, showClientPriorityNotification } = await import(
  '../../../src/presentation/dom/shell/BuildingNotifications.js'
);

// The on-pick toasts (what a building needs, who buys its output) are noise for a building the catalog
// did not ask to raise them for — `placementNotice` is the opt-in, off by default.
describe('the on-pick toasts only fire for a building type that declares placementNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('an industry that declares placementNotice gets its needs toast', () => {
    showPlacementNeedsNotification('Factory-Furniture');
    expect(showInfoToast).toHaveBeenCalledTimes(1);
  });

  test('a house has needs too (its own business), but stays silent: it never declared placementNotice', () => {
    showPlacementNeedsNotification('House-Blue');
    expect(showInfoToast).not.toHaveBeenCalled();
  });

  test('a house that has clients too (House-Red sells to House-Blue) stays silent on that as well', () => {
    showClientPriorityNotification('House-Red', { producerType: 'House-Red', clients: [{ type: 'House-Blue', disabled: false }] });
    expect(showInfoToast).not.toHaveBeenCalled();
  });

  test('a producer that declares placementNotice and has clients gets told who it serves first', () => {
    showClientPriorityNotification('Factory-Oil', { producerType: 'Factory-Oil', clients: [{ type: 'Market-Stall', disabled: false }] });
    expect(showInfoToast).toHaveBeenCalledTimes(1);
  });
});
