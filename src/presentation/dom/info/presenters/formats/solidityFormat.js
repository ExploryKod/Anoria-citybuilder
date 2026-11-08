import { SOLIDITY_MAX } from '../../../../../shared/solidity/SolidityCatalog.js';
import { solidityOf, solidityStatusOf } from '../../../../../shared/solidity/SolidityPolicy.js';

/** What each state of the bar tells the player. */
const STATUS_TEXT = Object.freeze({
  sound: 'Solide : le bâtiment est bien entretenu.',
  warning: 'Fragilisé : sans entretien, il risque de s’effondrer dans les mois qui viennent.',
  'at-risk': 'En danger : il peut s’effondrer à tout moment et tuer ceux qui s’y trouvent.',
});

/**
 * The solidity bar of a building (docs/gameplay/PLAN_COLLAPSE.md) for the État tab.
 * @param {{ buildingRow: object | null }} vm
 * @returns {{ percent: number, status: 'sound' | 'warning' | 'at-risk', text: string } | null} null for a building with no bar (a road, the nature)
 */
export function formatSolidityModel(vm) {
  if (!vm.buildingRow) return null;
  const solidity = solidityOf(vm.buildingRow);
  if (solidity === null) return null;
  const status = solidityStatusOf(solidity);
  return { percent: Math.round((solidity / SOLIDITY_MAX) * 100), status, text: STATUS_TEXT[status] };
}
