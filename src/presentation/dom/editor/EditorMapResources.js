import { onEditorStackChange, getEditorStackObjects } from '../../three/editor/editorNatureLayout.js';
import { propsHoldingRecord } from '../../../shared/editor-catalog/naturePropCatalog.js';
import { goodAmount, goodIcon } from '../shell/CatalogVocabulary.js';

/**
 * What the map being built holds: the sum, per good, of what its pieces of nature hold (the wood of its trees, the stone of its rocks...), kept up to date as
 * pieces are placed and removed. The game gives each piece its record when the map is first played, so these figures are what the hamlet starts with.
 * (Iron, gold, ore and clay are not tied to a piece of nature yet.)
 */
export function initEditorMapResources() {
  const el = document.getElementById('editor-map-resources');
  if (!el) {
    throw new Error('[EditorMapResources] #editor-map-resources is missing from game.html');
  }

  const render = (pieces) => {
    /** @type {Map<string, number>} */
    const totals = new Map();
    for (const { stocks } of propsHoldingRecord(pieces)) {
      for (const [good, amount] of Object.entries(stocks)) {
        totals.set(good, (totals.get(good) ?? 0) + amount);
      }
    }
    el.textContent = [...totals].map(([good, amount]) => `${goodIcon(good)} ${goodAmount(good, amount)}`).join(' · ');
  };

  onEditorStackChange(render);
  render(getEditorStackObjects());
}
