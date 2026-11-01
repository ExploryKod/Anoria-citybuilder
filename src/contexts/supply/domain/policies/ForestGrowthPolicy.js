import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import { getLandUse } from '../../../../shared/land-catalog/LandUseCatalog.js';

/** The key of a month in the calendar: the months since year 0. */
export const monthKeyOf = ({ year, monthIndex }) => year * MONTHS_PER_YEAR + monthIndex;

/**
 * What happens to one tile of a plot an owner holds, this month: nothing, or it moves to another stage of the crop of its use (see `crop` in LandUseCatalog.js).
 * A plant becomes a tree after the plant's months, a tree a high tree after the tree's; a tree or high tree whose record is gone (used up) leaves the tile fallow,
 * and after the fallow months a plant is set again. A tile with no crop yet is planted.
 *
 * @param {object} params
 * @param {string} params.use the plot's use
 * @param {{ stage: 'plant' | 'tree' | 'treeHigh' | 'fallow', since: number } | null} params.crop where the tile stands (`since`: the month key it entered its stage)
 * @param {boolean} params.hasRecord whether the tile's tree still has its record (a plant holds nothing, its record only stands for the piece)
 * @param {number} params.nowKey this month's key
 * @returns {'plant' | 'tree' | 'treeHigh' | 'fallow' | null} the stage it moves to, null to stay as it is
 */
export function nextCropStage({ use, crop, hasRecord, nowKey }) {
  const { stages, fallowMonths } = getLandUse(use).crop;
  if (crop === null) return 'plant';
  const age = nowKey - crop.since;
  switch (crop.stage) {
    case 'plant':
      if (!hasRecord) return 'plant';
      return age >= stages.plant.months ? 'tree' : null;
    case 'tree':
      if (!hasRecord) return 'fallow';
      return age >= stages.tree.months ? 'treeHigh' : null;
    case 'treeHigh':
      return hasRecord ? null : 'fallow';
    case 'fallow':
      return age >= fallowMonths ? 'plant' : null;
    default:
      throw new Error(`[forest] a tile of "${use}" is at the unknown stage "${crop.stage}"`);
  }
}
