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

// The player's permission (Paramètres) and the flags a game keeps: faked, the codes are what is under test
let cheatCodesAllowed = true;
const writeGameCheatFlag = jest.fn(async () => {});
jest.unstable_mockModule('../../src/config/cheatCodes.js', () => ({
  isCheatCodesAllowed: () => cheatCodesAllowed,
}));
jest.unstable_mockModule('../../src/core/persistence/cheat/gameCheatFlags.js', () => ({
  GAME_CHEAT_FLAGS: { houseLevelsUnlocked: 'houseLevelsUnlocked', housePopulation: 'housePopulation' },
  writeGameCheatFlag,
}));

const { applyCheatCode } = await import('../../src/composition/applyCheatCode.js');

describe('applyCheatCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cheatCodesAllowed = true;
  });

  test('nothing opens until the player allowed cheat codes: even a known code is refused, and nothing is recorded', async () => {
    cheatCodesAllowed = false;
    for (const code of ['Treasury', 'GetLastLevel', 'MaxPop12', 'Nope']) {
      expect(await applyCheatCode(code)).toEqual({ ok: false, reason: 'not_allowed' });
    }
    expect(recordCommerceExportIncome).not.toHaveBeenCalled();
    expect(writeGameCheatFlag).not.toHaveBeenCalled();
    expect(recordCheatActivation).not.toHaveBeenCalled();
  });

  test('GetLastLevel and MaxPop<n> set a flag of the game (MaxPop only from 1 to 1000)', async () => {
    expect((await applyCheatCode('GetLastLevel')).ok).toBe(true);
    expect(writeGameCheatFlag).toHaveBeenCalledWith('houseLevelsUnlocked', true);

    expect((await applyCheatCode('MaxPop12')).ok).toBe(true);
    expect(writeGameCheatFlag).toHaveBeenCalledWith('housePopulation', 12);

    writeGameCheatFlag.mockClear();
    expect(await applyCheatCode('MaxPop0')).toEqual({ ok: false, reason: 'invalid_value' });
    expect(await applyCheatCode('MaxPop1001')).toEqual({ ok: false, reason: 'invalid_value' });
    expect(writeGameCheatFlag).not.toHaveBeenCalled();
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
