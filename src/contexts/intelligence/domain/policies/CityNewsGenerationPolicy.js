/**
 * Planifie 0–2 dépêches ville à partir des signaux (Phase 1).
 * Priorité : revelation > complaint. Pas d'effet monde.
 *
 * @param {object} params
 * @param {number} params.turn
 * @param {{
 *   famishedPopulation?: number,
 *   totalPopulation?: number,
 *   unemploymentPercentage?: number,
 *   lack?: number,
 * }} params.signals
 * @param {() => number} [params.rng] — [0, 1)
 * @returns {Array<{
 *   sourceId: 'city',
 *   categoryId: string,
 *   title: string,
 *   body: string,
 *   teaser?: string,
 *   reliability?: 'trusted' | 'uncertain' | 'biased',
 *   revelation: 'free',
 * }>}
 */
export function planCityNewsDrafts({ turn, signals = {}, rng = Math.random }) {
  const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
  const pop = Math.max(0, Number(signals.totalPopulation) || 0);
  const unemployment = Math.max(0, Number(signals.unemploymentPercentage) || 0);
  const lack = Math.max(0, Number(signals.lack) || 0);

  /** @type {ReturnType<typeof planCityNewsDrafts>} */
  const drafts = [];

  if (famished > 0) {
    const ratio = pop > 0 ? famished / pop : 1;
    if (ratio >= 0.15 || famished >= 20) {
      drafts.push({
        sourceId: 'city',
        categoryId: 'revelation',
        title: 'Les greniers se vident',
        body: `Des familles affamées sont signalées en ville (${famished} personnes). Vérifiez la distribution alimentaire et les stocks des maisons.`,
        teaser: 'Des rumeurs de famine circulent…',
        reliability: 'trusted',
        revelation: 'free',
      });
    } else {
      drafts.push({
        sourceId: 'city',
        categoryId: 'complaint',
        title: 'Plainte : « On a faim ! »',
        body: `Des citoyens se plaignent du manque de nourriture. Environ ${famished} personnes n'auraient pas mangé correctement ce mois-ci.`,
        teaser: 'Des habitants grognent près du forum…',
        reliability: famished > 0 ? 'trusted' : 'uncertain',
        revelation: 'free',
      });
    }
  }

  if (unemployment >= 25 || lack >= 10) {
    drafts.push({
      sourceId: 'city',
      categoryId: 'complaint',
      title: 'Plainte : chômage et bras inutiles',
      body:
        unemployment >= 25
          ? `Le chômage atteint environ ${Math.round(unemployment)} %. Des oisifs s'agglutinent aux carrefours.`
          : `Des postes restent vacants (manque estimé : ${lack}). Les ateliers peinent à recruter.`,
      teaser: 'Remue-ménage sur la place du travail…',
      reliability: 'uncertain',
      revelation: 'free',
    });
  }

  // Flavour occasionnel si rien de critique
  if (drafts.length === 0 && rng() < 0.35) {
    drafts.push({
      sourceId: 'city',
      categoryId: 'revelation',
      title: 'Nouvelle du quartier',
      body: 'Les rues sont calmes ce mois-ci. Les citoyens vaquent à leurs occupations sans incident notable.',
      teaser: 'Un messager apporte une dépêche…',
      reliability: 'trusted',
      revelation: 'free',
    });
  }

  // Cap 2 ; priorité revelation
  drafts.sort((a, b) => {
    const score = (d) => (d.categoryId === 'revelation' ? 0 : 1);
    return score(a) - score(b);
  });

  void turn;
  return drafts.slice(0, 2);
}
