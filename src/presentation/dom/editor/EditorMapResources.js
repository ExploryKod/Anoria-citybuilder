import { onEditorStackChange, getEditorStackObjects } from '../../three/editor/editorNatureLayout.js';
import { propsHoldingRecord } from '../../../shared/editor-catalog/naturePropCatalog.js';
import { listDepositKinds } from '../../../shared/building-catalog/depositQueries.js';
import { showEditorMapNature } from '../shell/GameUI.js';

/**
 * What the map being built holds: the sum, per good, of what its pieces of nature hold (the wood of its trees, the iron of its large rocks...), kept up to date as
 * pieces are placed and removed. It is shown where the player reads it in the game, the "nature" tab of the population rail (every good of that tab, 0 for the
 * ones the map holds none of). The game gives each piece its record when the map is first played, so these figures are what the hamlet starts with.
 * (Clay is the ground's, not a piece's: the editor does not count it yet.)
 */
export function initEditorMapResources() {
  const render = (pieces) => {
    const totals = Object.fromEntries(listDepositKinds().map((good) => [good, 0]));
    for (const { stocks } of propsHoldingRecord(pieces)) {
      for (const [good, amount] of Object.entries(stocks)) {
        if (!(good in totals)) {
          throw new Error(`[EditorMapResources] "${good}" is held by a piece of nature but is not a deposit kind of the catalog`);
        }
        totals[good] += amount;
      }
    }
    showEditorMapNature(totals);
  };

  onEditorStackChange(render);
  render(getEditorStackObjects());
}
