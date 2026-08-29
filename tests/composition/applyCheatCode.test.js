import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const recordCommerceExportIncome = jest.fn(async () => ({ recorded: true }));
const syncSessionHud = jest.fn(async () => {});
const unlockAllHamlets = jest.fn(async () => 3);
const recordCheatActivation = jest.fn(async (code, meta) => ({
  code,
  activatedAt: new Date().toISOString(),
  activationCount: 1,
  lastMeta: meta,
}));
const getTimeManager = jest.fn(() => ({ getCurrentTurn: () => 4 }));

jest.unstable_mockModule('../../src/config/cheatCodes.js', () => ({
  isCheatCodesEnabled: () => true,
}));

jest.unstable_mockModule('../../src/composition/createAccountingContext.js', () => ({
  getOrCreateAccountingContext: () => ({ recordCommerceExportIncome }),
}));

jest.unstable_mockModule('../../src/composition/syncSessionHud.js', () => ({
  syncSessionHud,
}));

jest.unstable_mockModule('../../src/core/persistence/hamlet/hamletAccess.js', () => ({
  unlockAllHamlets,
}));

jest.unstable_mockModule('../../src/core/persistence/cheat/cheatCodeRepository.js', () => ({
  recordCheatActivation,
  normalizeCheatCode: (code) => String(code ?? '').trim(),
}));

jest.unstable_mockModule('../../src/composition/sessionShell.js', () => ({
  getTimeManager,
}));

const { applyCheatCode } = await import('../../src/composition/applyCheatCode.js');

describe('applyCheatCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Treasury records income and persists activation', async () => {
    const result = await applyCheatCode('Treasury');

    expect(result.ok).toBe(true);
    expect(result.code).toBe('Treasury');
    expect(recordCommerceExportIncome).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, productId: 'cheat_treasury' })
    );
    expect(syncSessionHud).toHaveBeenCalled();
    expect(recordCheatActivation).toHaveBeenCalledWith('Treasury', expect.any(Object));
  });

  test('HamletsAll unlocks all hamlets', async () => {
    const result = await applyCheatCode('HamletsAll');

    expect(result.ok).toBe(true);
    expect(unlockAllHamlets).toHaveBeenCalled();
    expect(recordCheatActivation).toHaveBeenCalledWith('HamletsAll', expect.any(Object));
  });

  test('unknown code returns reason unknown', async () => {
    const result = await applyCheatCode('Nope');
    expect(result).toEqual({ ok: false, reason: 'unknown' });
    expect(recordCheatActivation).not.toHaveBeenCalled();
  });
});
