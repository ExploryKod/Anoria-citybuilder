/**
 * @jest-environment jsdom
 */
import { renderRichText } from '../../../../src/presentation/dom/shell/richText.js';

// The texts of the modals come from catalogs, but also from what the player types (a hamlet's name): whatever they hold only ever becomes text, never markup.
describe('richText', () => {
  test('markup in a text stays text: no element is created from it', () => {
    const container = document.createElement('div');
    renderRichText(container, '<img src=x onerror="alert(1)"> **<script>alert(1)</script>**\n\n- <b>liste</b>\n\n## <i>titre</i>');
    expect(container.querySelector('img, script, b, i')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  test('lays the text out in blocks: paragraph, list, heading, bold', () => {
    const container = document.createElement('div');
    renderRichText(container, 'Un **mot** gras.\n\n## Titre\nSuite\n- a\n- b');
    expect([...container.children].map((node) => node.tagName)).toEqual(['P', 'H3', 'P', 'UL']);
    expect(container.querySelector('strong').textContent).toBe('mot');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });
});
