/**
 * @jest-environment jsdom
 */
import { html, raw, escapeHtml } from '../../../../src/presentation/dom/shell/safeHtml.js';
import { showInfoToast, showErrorToast } from '../../../../src/presentation/dom/shell/ToastNotifier.js';
import { playerNameProblem } from '../../../../src/shared/player-identity/PlayerNamePolicy.js';

const PAYLOAD = '<img src=x onerror="window.__pwned = true"><script>window.__pwned = true</script>';

// What a player types (a profile, the pseudo other players read in a toast) must never become markup.
describe('XSS guards', () => {
  test('the toasts show a message as text: the library puts it in innerHTML, the wrapper escapes it first', async () => {
    // jsdom has no matchMedia, which the library reads (the reduced-motion preference).
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    await showInfoToast(`${PAYLOAD} a rejoint`);
    await showErrorToast(PAYLOAD);
    expect(document.querySelector('img, script')).toBeNull();
    expect(window.__pwned).toBeUndefined();
    expect(document.body.textContent).toContain('<img src=x');
  });

  test('html`` escapes every value, in text and in an attribute, and does not escape its own markup twice', () => {
    const container = document.createElement('div');
    container.innerHTML = html`<ul data-name="${'"><img src=x>'}">${[PAYLOAD, 'b'].map((value) => html`<li>${value}</li>`)}<li>${raw('<b>icône</b>')}</li></ul>`;
    expect(container.querySelector('img, script')).toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelector('b').textContent).toBe('icône');
    expect(container.querySelector('ul').dataset.name).toBe('"><img src=x>');
    expect(escapeHtml('<&>"\'`')).toBe('&lt;&amp;&gt;&quot;&#39;&#96;');
  });

  test('a player name that is markup is refused by the rule, a real name is not', () => {
    for (const bad of [PAYLOAD, '"><svg onload=1>', '', '   ', '-tiret', 'a'.repeat(33), 'a<b']) {
      expect(playerNameProblem(bad)).not.toBeNull();
    }
    for (const good of ['Démo', "Jean-Luc O'Neil", '李雷', 'Joueur 2', 'a'.repeat(32)]) {
      expect(playerNameProblem(good)).toBeNull();
    }
  });
});
