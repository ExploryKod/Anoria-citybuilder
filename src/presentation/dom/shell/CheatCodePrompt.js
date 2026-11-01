/**
 * Discrete cheat-code input — Ctrl+Alt+K.
 */

import { applyCheatCode } from '../../../composition/applyCheatCode.js';
import { isCheatCodesAllowed } from '../../../config/cheatCodes.js';
import { initCheatBadge, refreshCheatBadge } from './CheatBadge.js';

/**
 * @param {HTMLElement} root
 * @param {boolean} open
 */
function setPromptOpen(root, open) {
  root.hidden = !open;
  root.inert = !open;
  root.classList.toggle('is-open', open);
  root.setAttribute('aria-hidden', open ? 'false' : 'true');
}

export function initCheatCodePrompt() {
  // The badge that says a cheat is in force, on every page that has the prompt (it is independent of the prompt's own markup).
  initCheatBadge();
  const root =document.getElementById('cheat-code-prompt');
  const form = document.getElementById('cheat-code-form');
  const input = document.getElementById('cheat-code-input');
  const feedback = document.getElementById('cheat-code-feedback');
  if (!root || !(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) return;

  let open = false;

  function showFeedback(message, kind = 'info') {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.kind = kind;
    feedback.hidden = !message;
  }

  function close() {
    open = false;
    setPromptOpen(root, false);
    input.value = '';
    showFeedback('');
  }

  function openPrompt() {
    open = true;
    setPromptOpen(root, true);
    showFeedback('');
    requestAnimationFrame(() => input.focus());
  }

  function togglePrompt() {
    if (open) close();
    else openPrompt();
  }

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey || e.key.toLowerCase() !== 'k') return;
    // The prompt does not exist for a player who has not allowed cheat codes (Paramètres): the shortcut is left alone, not even announced.
    if (!isCheatCodesAllowed()) return;
    e.preventDefault();
    e.stopPropagation();
    togglePrompt();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value;
    void (async () => {
      const result = await applyCheatCode(raw);
      if (result.ok) {
        void refreshCheatBadge();
        showFeedback(result.message, 'success');
        input.value = '';
        input.focus();
        return;
      }
      const messages = {
        empty: 'Saisissez un code.',
        unknown: 'Code inconnu.',
        invalid_value: 'Valeur invalide (MaxPop<nombre>, de 1 à 1000).',
        not_allowed:'Les codes de triche ne sont pas autorisés (Paramètres).',
      };
      showFeedback(messages[result.reason] ?? 'Échec.', 'error');
      input.select();
    })();
  });

  document.addEventListener('keydown', (e) => {
    if (!open || e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!root.contains(target)) close();
  });

  setPromptOpen(root, false);
}
