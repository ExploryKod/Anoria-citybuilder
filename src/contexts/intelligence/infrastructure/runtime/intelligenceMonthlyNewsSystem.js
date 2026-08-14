/**
 * Thin ECS adapter — génération **mensuelle** des dépêches (ville + caravane)
 * (1er jour du mois calendaire jeu uniquement).
 *
 * @param {object} deps
 * @param {{ generateMonthlyNews?: Function, generateMonthlyCityNews?: Function }} deps.intelligence
 * @param {(time: number) => { dayInMonth: number }} deps.getTimeInfo
 */
export function createIntelligenceMonthlyNewsSystem({ intelligence, getTimeInfo }) {
  return async function intelligenceMonthlyNews(_world, context = {}) {
    const time = context.time ?? 0;
    const timeInfo = getTimeInfo(time);
    if ((timeInfo?.dayInMonth ?? 1) !== 1) {
      return;
    }
    if (typeof intelligence.generateMonthlyNews === 'function') {
      await intelligence.generateMonthlyNews({ turn: time });
      return;
    }
    await intelligence.generateMonthlyCityNews?.({ turn: time });
  };
}
