/**
 * Catalogue des dépêches jouables (données gameplay).
 *
 * Le pipeline intelligence (génération, modal, archives) reste branché ;
 * seules ces listes déterminent ce qui est produit en jeu.
 *
 * Réactiver les brouillons MVP :
 *   export const CITY_NEWS_ENTRIES = CITY_NEWS_ENTRIES_MVP;
 *   export const CARAVAN_NEWS_ENTRIES = CARAVAN_NEWS_ENTRIES_MVP;
 */

import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { SOCIAL_CATEGORY, OWNER_SKILL, TAX_COLLECTION_SKILLS } from '../../../../shared/population/socialCategoryCatalog.js';
import { getSkillDisplay } from '../../../../shared/population/skillCatalog.js';
import { DIPLOMATIC_GESTURES, TRADE_FLOW_WORDING } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * @typedef {object} CityNewsSignals
 * @property {number} [famishedPopulation]
 * @property {number} [totalPopulation]
 * @property {number} [unemploymentPercentage]
 * @property {number} [lack]
 */

/**
 * @typedef {object} CityNewsEntry
 * @property {string} [id]
 * @property {(signals: CityNewsSignals, rng: () => number) => boolean} when
 * @property {(signals: CityNewsSignals) => object} draft
 * @property {number} [sortScore]
 */

/**
 * @typedef {object} CaravanNewsEntry
 * @property {string} categoryId
 * @property {string} title
 * @property {string} body
 * @property {string} teaser
 * @property {number} weight
 */

/** Brouillons ville MVP (référence — non actifs en jeu). */
export const CITY_NEWS_ENTRIES_MVP = [
  {
    id: 'famine_revelation',
    sortScore: 0,
    when: (signals) => {
      const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
      const pop = Math.max(0, Number(signals.totalPopulation) || 0);
      if (famished <= 0) return false;
      const ratio = pop > 0 ? famished / pop : 1;
      return ratio >= 0.15 || famished >= 20;
    },
    draft: (signals) => {
      const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
      return {
        sourceId: 'city',
        categoryId: 'revelation',
        title: 'Les greniers se vident',
        body: `Des familles affamées sont signalées en ville (${famished} personnes). Vérifiez la distribution alimentaire et les stocks des maisons.`,
        teaser: 'Des rumeurs de famine circulent…',
        reliability: 'trusted',
        revelation: 'free',
      };
    },
  },
  {
    id: 'famine_complaint',
    sortScore: 1,
    when: (signals) => {
      const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
      const pop = Math.max(0, Number(signals.totalPopulation) || 0);
      if (famished <= 0) return false;
      const ratio = pop > 0 ? famished / pop : 1;
      return ratio < 0.15 && famished < 20;
    },
    draft: (signals) => {
      const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
      return {
        sourceId: 'city',
        categoryId: 'complaint',
        title: 'Plainte : « On a faim ! »',
        body: `Des citoyens se plaignent du manque de nourriture. Environ ${famished} personnes n'auraient pas mangé correctement ce mois-ci.`,
        teaser: 'Des habitants grognent près du forum…',
        reliability: famished > 0 ? 'trusted' : 'uncertain',
        revelation: 'free',
      };
    },
  },
  {
    id: 'employment_complaint',
    sortScore: 1,
    when: (signals) => {
      const unemployment = Math.max(0, Number(signals.unemploymentPercentage) || 0);
      const lack = Math.max(0, Number(signals.lack) || 0);
      return unemployment >= 25 || lack >= 10;
    },
    draft: (signals) => {
      const unemployment = Math.max(0, Number(signals.unemploymentPercentage) || 0);
      const lack = Math.max(0, Number(signals.lack) || 0);
      return {
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
      };
    },
  },
  {
    id: 'flavour',
    sortScore: 0,
    when: (_signals, rng) => rng() < 0.35,
    draft: () => ({
      sourceId: 'city',
      categoryId: 'revelation',
      title: 'Nouvelle du quartier',
      body: 'Les rues sont calmes ce mois-ci. Les citoyens vaquent à leurs occupations sans incident notable.',
      teaser: 'Un messager apporte une dépêche…',
      reliability: 'trusted',
      revelation: 'free',
    }),
  },
];

/** Brouillons caravane MVP (référence — non actifs en jeu). */
export const CARAVAN_NEWS_ENTRIES_MVP = [
  {
    categoryId: 'trade_rumor',
    title: 'Rumeur sur les marchés étrangers',
    body: 'Un commerçant de passage affirme que le blé se vend cher chez un partenaire voisin. Vérifiez vos stocks avant d’ouvrir de nouveaux échanges.',
    teaser: 'Un caravanier murmure des nouvelles des routes…',
    weight: 0.34,
  },
  {
    categoryId: 'partner_news',
    title: 'Tension chez un partenaire',
    body: 'Des voyageurs rapportent des troubles politiques chez l’un de vos partenaires commerciaux. Les prochaines caravanes pourraient être moins régulières.',
    teaser: 'Des nouvelles inquiétantes arrivent avec les mulets…',
    weight: 0.33,
  },
  {
    categoryId: 'foreign_market',
    title: 'Opportunité sur un marché extérieur',
    body: 'Un négociant propose une piste d’export rentable pour le bois, si vos granges et quotas le permettent. L’information seule ne crée pas le contrat.',
    teaser: 'Un négociant veut vendre une information…',
    weight: 0.33,
  },
];

/**
 * Les dépêches qui marquent un moment de la partie (récit écrit à la main), une par identifiant de jalon : voir AnnounceMilestone.js.
 * Chacune reçoit ce que son texte demande (une somme déjà écrite par la monnaie du jeu, par exemple).
 * @type {Record<string, (params: any) => object>}
 */
const MILESTONE_DRAFTS = {
  // Avant le tour où la ville reçoit son argent de départ : le trésor trouvé en chemin. `amountLabel` : « 500 € ».
  // Elle porte le bouton de la maison du maire : tout commence par elle (voir `requiresPlaced` des autres maisons).
  'starting-fortune': ({ amountLabel }) => {
    const owner = getSkillDisplay(OWNER_SKILL).label.toLowerCase();
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: 'Vous décidez de rester',
      body: `Vous décidez de rester sur ce territoire. Vous dotez le budget de votre ville avec le trésor trouvé en chemin, ${amountLabel}, pour bâtir vos premières maisons. `
        + `Tout commence par la vôtre : cliquez sur la maison ci-dessous, puis placez-la sur la carte. C'est elle qui fait de vous un ${owner} et ouvre la construction de toutes les autres.`,
      teaser: 'Vous avez fait votre choix…',
      reliability: 'trusted',
      revelation: 'free',
      action: { kind: 'buildTool', toolId: 'House-Mayor' },
    };
  },
  // La première maison du maire : son rôle, et ce que ses deux compétences permettent. Les noms viennent des catalogues.
  'mayor-house': () => {
    const house = getBuildingDefinition('House-Mayor').displayName;
    const owner = getSkillDisplay(OWNER_SKILL).label.toLowerCase();
    // The collections the first tier grants: every tax.
    const collections = Object.keys(SOCIAL_CATEGORY.administrators.tiers[1].skills)
      .filter((skill) => skill !== OWNER_SKILL)
      .map((skill) => `- **${getSkillDisplay(skill).label}**`)
      .join('\n');
    const administrators = SOCIAL_CATEGORY.administrators.tiers[1].maxPopulation;
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: 'La maison du maire est bâtie',
      body: [
        `Les **${house.toLowerCase()}** de la ville s'installent (${administrators} au plus). Leur maison leur donne des compétences, d'office.`,
        `## ${owner.charAt(0).toUpperCase()}${owner.slice(1)}\nIls perçoivent les **loyers**, et leur maison est la condition pour **bâtir toutes les autres maisons**.`,
        `## Percevoir les impôts\nIls perçoivent les impôts des autres maisons :\n${collections}`,
      ].join('\n\n'),
      teaser: 'Les administrateurs prennent leurs quartiers…',
      reliability: 'trusted',
      revelation: 'free',
    };
  },
  // November came and nobody holds the tax collector skill: the citizen tax of the year was not collected. Says who collects it.
  'tax-uncollected': () => {
    const house = getBuildingDefinition('House-Mayor').displayName;
    const collector = getSkillDisplay(TAX_COLLECTION_SKILLS.citizen).label.toLowerCase();
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: "L'impôt n'a pas été levé",
      body: [
        `Personne n'a la compétence « **${collector}** » : l'impôt citoyen de l'année **n'a pas été collecté**.`,
        `## Que faire ?\nElle revient aux **${house.toLowerCase()}**, qui vivent dans la maison du maire : bâtissez-la et logez-y du monde, et l'impôt sera levé dès ce mois.`,
      ].join('\n\n'),
      teaser: 'Les caisses restent vides…',
      reliability: 'trusted',
      revelation: 'free',
    };
  },
  // The State may not spend more than its Treasury holds (docs/gameplay/PLAN_BANK_MONEY.md): in a month it could not pay what it owed, the player is told what stayed unpaid
  // and how to fill the Treasury again. `items`: what was left unpaid, by kind of payment (`{ label, amount }` in euros).
  'state-unpaid': ({ items }) => {
    if (!Array.isArray(items) || items.length === 0) throw new Error('[news] the State\'s unpaid payments are announced with what stayed unpaid (items)');
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    // One list line per payment: the amount in bold, the label first (the layout is richText.js's: headings with `## `, lists with `- `, bold with `**`).
    const listOf = (list) => list.map((item) => `- ${item.label} : **${item.amount.toLocaleString('fr-FR')} €**`).join('\n');
    // What the State still owes (it will pay it, the households first, as soon as its Treasury allows) is told apart from what is lost for good.
    const carried = items.filter((item) => item.carried);
    const lost = items.filter((item) => !item.carried);
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: 'Le Trésor est vide',
      body: [
        `Ce mois-ci, l'État n'a pas pu payer **${total.toLocaleString('fr-FR')} €** de ce qu'il devait : les ménages et les entreprises concernés n'ont pas reçu leur dû.`,
        carried.length > 0 ? `## Reste dû\nRéglé dès que le Trésor le permet, les ménages d'abord.\n${listOf(carried)}` : null,
        lost.length > 0 ? `## Perdu, jamais rattrapé\n${listOf(lost)}` : null,
        '## Que faire ?\nL\'État ne dépense pas plus que son Trésor ne contient. Il faut le remplir :\n- **lever des impôts**\n- **vendre à l\'étranger**\n- **emprunter à la banque**',
      ].filter(Boolean).join('\n\n'),
      teaser: 'Les caisses de l\'État sonnent creux…',
      reliability: 'trusted',
      revelation: 'free',
      quietAfterFirst: true,
    };
  },
  // The year opens in a phase that is not an ordinary one (src/shared/climate): the fields will yield more or less than the catalog says.
  'climate-year': ({ year, phase, harvestFactor }) => {
    const words = {
      plentiful: { title: 'Une année généreuse s’annonce', body: 'Le ciel est clément : les champs promettent plus que de coutume. Les greniers se rempliront, mais une récolte trop abondante fait baisser les prix.' },
      poor: { title: 'Une mauvaise année s’annonce', body: 'Le temps est mauvais : les champs donneront moins que de coutume. Les grains seront plus rares et plus chers.' },
      disastrous: { title: 'Une année désastreuse s’annonce', body: 'Hiver rigoureux, pluies noyées : les récoltes seront très en deçà de ce que la ville mange. Prévoyez des greniers, et attendez-vous à la cherté du grain.' },
    }[phase];
    if (!words) throw new Error(`[news] "${phase}" is not a phase of the climate that is announced`);
    const share = Math.round(harvestFactor * 100);
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: words.title,
      body: `${words.body} (Année ${year + 1} : les récoltes de blé seront à environ ${share} % de l'ordinaire.)`,
      teaser: words.title,
      reliability: 'trusted',
      revelation: 'free',
    };
  },
  // A partner city offers the city a gift when it has no money left (BenefactorGiftCatalog.js). The dépêche's button accepts it, its choice refuses it (no consequence yet).
  'benefactor-gift': ({ cityName, amount }) => {
    if (!cityName || !Number.isFinite(amount)) throw new Error(`[news] the gift needs the benefactor city's name and the amount, got ${cityName} and ${amount}`);
    const sum = amount.toLocaleString('fr-FR');
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: `${cityName} vous offre un don`,
      body: `Curieuse, ${cityName} aimerait vous voir évoluer et sait que vous le lui revaudrez : elle vous donne donc ${sum} € pour vous aider à démarrer.`,
      teaser: `${cityName} tend la main…`,
      action: { kind: 'acceptGift', cityName, amount },
      choices: [{ label: 'Refuser', action: { kind: 'refuseGift' }, page: { body: `Vous remerciez ${cityName} et déclinez son offre. Elle n'en tiendra pas rigueur.` } }],
      reliability: 'trusted',
      revelation: 'free',
    };
  },
  // A partner city decrees an embargo on us (PartnerPolicy): to answer an embargo of ours, or of its own initiative. `flow` is ours (`export`: it stops buying our good, `import`: it stops selling us its own).
  'trade-partner-embargo': ({ cityName, goodName, flow, months, reason }) => {
    if (!cityName || !goodName || !TRADE_FLOW_WORDING[flow] || !Number.isFinite(months)) throw new Error(`[news] a partner embargo needs the city, the good, the flow and its length, got ${cityName}, ${goodName}, ${flow}, ${months}`);
    if (!['retaliation', 'spontaneous'].includes(reason)) throw new Error(`[news] "${reason}" is not a reason of a partner embargo`);
    const why = reason === 'retaliation'
      ? `C'est la **réponse** à l'embargo que vous avez décrété : ${cityName} ne laisse pas passer.`
      : `Ses marchands jugent la relation **dégradée** : un climat tendu, des **droits de douane** trop hauts ou vos propres **embargos** pèsent sur la décision.`;
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: `${cityName} décrète un embargo`,
      body: [
        `**${cityName}** a décrété un embargo sur **${goodName}** (${TRADE_FLOW_WORDING[flow]}) pour **${months} mois**.`,
        `## Pourquoi ?\n${why}`,
        '## Que faire ?\n- **lever vos propres embargos** sur cette ville\n- **faire un don** pour apaiser la relation\n- **attendre** : l\'embargo se lève à son terme',
      ].join('\n\n'),
      teaser: `${cityName} ferme sa porte à ${goodName}…`,
      reliability: 'trusted',
      revelation: 'free',
    };
  },
  // A partner city cuts the relation (its `embargoReaction` is to break, and the relation fell under its threshold): no more exchange until a mission renews it.
  'trade-relation-broken': ({ cityName }) => {
    if (!cityName) throw new Error('[news] a broken relation needs the partner\'s name');
    const { cooldownMonths, cost } = DIPLOMATIC_GESTURES.renewal;
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: `${cityName} rompt la relation`,
      body: [
        `**${cityName}** met fin à toutes ses relations commerciales avec vous : **plus aucun échange** tant que la relation n'est pas renouée.`,
        `## Que faire ?\nAttendez **${cooldownMonths} mois**, puis envoyez une **mission de renouement** (**${cost.toLocaleString('fr-FR')} €**) depuis la fiche de la ville, dans la section Commerce du panneau d'administration.`,
      ].join('\n\n'),
      teaser: `${cityName} tourne le dos…`,
      reliability: 'trusted',
      revelation: 'free',
    };
  },
  // The bank's capital is thin against its loans: warned, then its lending frozen by the supervisor (LoanRatePolicy.capitalStatusOf), before it is insolvent.
  'bank-capital': ({ bankType, centralBankType, status, ratio }) => {
    const bank = getBuildingDefinition(bankType)?.displayName;
    const centralBank = getBuildingDefinition(centralBankType)?.displayName;
    if (!bank || !centralBank) throw new Error(`[news] the bank (${bankType}) or the central bank (${centralBankType}) has no catalog name: its capital cannot be announced`);
    if (!['warning', 'frozen'].includes(status)) throw new Error(`[news] "${status}" is not a state of the bank's capital that is announced`);
    const share = `${(ratio * 100).toFixed(1).replace('.', ',')} %`;
    const frozen = status === 'frozen';
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: frozen ? `${bank} ne peut plus prêter` : `${bank} manque de fonds propres`,
      body: `Les fonds propres de la banque ne représentent plus que ${share} de ses prêts. `
        + (frozen
          ? 'Le superviseur a gelé ses prêts : ni la ville ni les entreprises ne peuvent emprunter, tant qu\'elle n\'est pas recapitalisée ou que ses prêts n\'ont pas diminué. '
          : 'Si cela baisse encore, le superviseur gèlera ses prêts. ')
        + `Dans la section « ${centralBank} » du panneau d'administration, la ville peut la recapitaliser.`,
      teaser: frozen ? 'Le crédit est gelé…' : 'La banque s\'amincit…',
      reliability: 'trusted',
      revelation: 'free',
    };
  },
  // The bank's losses ate its capital: it is insolvent. Once a month while it stays so, the player is told what he can do, from the central bank's section.
  'bank-insolvent': ({ bankType, centralBankType, equity }) => {
    const bank = getBuildingDefinition(bankType)?.displayName;
    const centralBank = getBuildingDefinition(centralBankType)?.displayName;
    if (!bank || !centralBank) throw new Error(`[news] the bank (${bankType}) or the central bank (${centralBankType}) has no catalog name: the insolvency cannot be announced`);
    const shortfall = Math.ceil(-equity).toLocaleString('fr-FR');
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: `${bank} est insolvable`,
      body: `Ses pertes dépassent son capital de ${shortfall} € : elle doit plus qu'elle ne possède. Dans la section « ${centralBank} » du panneau d'administration, `
        + 'la ville peut la recapitaliser (elle apporte ce qui manque), ou la liquider : ses épargnants sont alors remboursés, la ville garantissant ce que sa caisse ne couvre pas. '
        + 'Tant que rien n\'est décidé, elle continue de fonctionner.',
      teaser: 'Les épargnants s\'inquiètent…',
      reliability: 'trusted',
      revelation: 'free',
    };
  },
};

/**
 * @param {string} milestoneId
 * @param {object} [params]
 */
export function milestoneDraft(milestoneId, params = {}) {
  const draft = MILESTONE_DRAFTS[milestoneId];
  if (!draft) throw new Error(`[news] "${milestoneId}" is not a milestone of NewsDraftCatalog.js: it has no dépêche to announce`);
  return draft(params);
}

/** Catalogue actif — vide jusqu’au prochain design gameplay. */
export const CITY_NEWS_ENTRIES = [];

/** Catalogue actif — vide jusqu’au prochain design gameplay. */
export const CARAVAN_NEWS_ENTRIES = [];
