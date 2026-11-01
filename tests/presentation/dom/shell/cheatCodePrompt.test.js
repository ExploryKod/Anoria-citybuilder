/**
 * @jest-environment jsdom
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const applyCheatCode = jest.fn(async (code) => {
  if (code === 'Treasury') {
    return { ok: true, code: 'Treasury', message: '+5000 € ajoutés au trésor.' };
  }
  return { ok: false, reason: 'unknown' };
});

jest.unstable_mockModule('../../../../src/composition/applyCheatCode.js', () => ({
  applyCheatCode,
}));

const { initCheatCodePrompt } = await import('../../../../src/presentation/dom/shell/CheatCodePrompt.js');
const { setCheatCodesAllowed } = await import('../../../../src/config/cheatCodes.js');

function mountPrompt() {
  document.body.innerHTML = `
    <div id="cheat-code-prompt" hidden aria-hidden="true" inert>
      <form id="cheat-code-form">
        <input id="cheat-code-input" type="text" />
        <button id="cheat-code-submit" type="submit">OK</button>
      </form>
      <p id="cheat-code-feedback" hidden></p>
    </div>
  `;
}

describe('CheatCodePrompt', () => {
  beforeEach(() => {
    mountPrompt();
    jest.clearAllMocks();
    setCheatCodesAllowed(true);
    initCheatCodePrompt();
  });

  test('the prompt does not open while the player has not allowed cheat codes', () => {
    setCheatCodesAllowed(false);
    const root = document.getElementById('cheat-code-prompt');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, altKey: true, bubbles: true })
    );

    expect(root.hidden).toBe(true);
  });

  test('Ctrl+Alt+K opens the prompt and focuses input', async () => {
    const root = document.getElementById('cheat-code-prompt');
    const input = document.getElementById('cheat-code-input');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, altKey: true, bubbles: true })
    );

    expect(root.hidden).toBe(false);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(input);
  });

  test('submitting a valid code calls applyCheatCode', async () => {
    const input = document.getElementById('cheat-code-input');
    const form = document.getElementById('cheat-code-form');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, altKey: true, bubbles: true })
    );

    input.value = 'Treasury';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await Promise.resolve();

    expect(applyCheatCode).toHaveBeenCalledWith('Treasury');
    const feedback = document.getElementById('cheat-code-feedback');
    expect(feedback.textContent).toContain('5000');
  });
});
