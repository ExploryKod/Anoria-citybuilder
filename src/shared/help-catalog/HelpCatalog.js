/**
 * The help behind the "?" of the screens (HelpButton.js): one catalog, hand-written, in the code. Nothing is stored in IndexedDB and nothing is generated: what
 * the player reads is chosen here, ahead of the events, and only the figures of the moment are filled in.
 *
 * An entry is `{ about, title, message, items?, figures?, states? }`:
 *   - `about`: what the "?" is about (its tooltip and its label for assistive technology);
 *   - `figures`: the live figures the text names, each with its kind (`euro`; `percent`, given as a ratio; `index`, three decimals), written `{name}` in the text. The caller gives
 *     every one of them, and nothing else: a missing or an unknown figure throws, and so does a figure no state of the entry writes (the test of the catalog), so a text and its
 *     figures cannot drift apart. A state may leave one out: its text need not name every figure of the entry;
 *   - `states`: the few situations the text is written for (a loss, a gain). The caller names the one the city is in; a text that is a `{ [state]: text }` object
 *     is read in that state, an item with a `when` is shown in that state only. A situation nobody wrote is not improvised: it is not a state of the entry.
 *     An entry with no `states` is the same whatever happens.
 *
 * Only what is not obvious has an entry (a term of accounting, a line whose size surprises); a line that says what it is has none. An account of the city's books
 * is `city.account.<number>`, so a line asks for it by its account (`helpIdOfAccount`). Adding a "?" is an entry here and a call on the screen, nothing else.
 */

/** @typedef {string | Readonly<Record<string, string>>} HelpText */
/** @typedef {{ label: HelpText, text: HelpText, when?: string } | { fragment: string }} HelpItem an item, or the name of a `FRAGMENTS` item shared by several entries (it names no figure) */
/** @typedef {{ about: string, title: string, message: HelpText, items?: ReadonlyArray<HelpItem>, figures?: Readonly<Record<string, 'euro' | 'percent' | 'index'>>, states?: ReadonlyArray<string> }} HelpEntry */

const LOSS_OR_GAIN = Object.freeze(['loss', 'gain']);

/**
 * Items several entries share, written once (an entry says `{ fragment: 'name' }`): a sentence that must be the same wherever it is read, so that changing it changes it
 * everywhere. A fragment names no figure: it is plain text.
 * @type {Readonly<Record<string, { label: string, text: string }>>}
 */
export const FRAGMENTS = Object.freeze({
  notTreasury: { label: 'Ce n’est pas la trésorerie', text: 'Un résultat compare des recettes et des dépenses ; la trésorerie est l’argent en caisse. Une ville peut avoir un bon résultat et peu d’argent (elle a investi), ou l’inverse (elle a emprunté).' },
  perYear: { label: 'Sur une année', text: 'Chiffre annuel : il agrège les mois écoulés, ramenés à une année quand la partie est jeune.' },
});

/** @type {Readonly<Record<string, HelpEntry>>} */
export const HELP = Object.freeze({
  // The balance sheet of the city: the Finances tab and the Patrimoine section read it the same way.
  'city.balanceSheet': {
    about: 'le bilan de la ville',
    title: 'Lire le bilan de la ville',
    message: 'Le bilan est une photo de la ville aujourd’hui, en deux colonnes qui valent toujours la même somme : à gauche ce que la ville détient, à droite d’où cela vient (ce qu’elle doit, l’argent qu’on lui a donné, ce qu’elle a gagné ou perdu).',
    figures: { assets: 'euro', liabilities: 'euro', cash: 'euro', result: 'euro' },
    states: LOSS_OR_GAIN,
    items: [
      { label: 'À gauche : {assets}', text: 'Tout ce que la ville possède : de l’argent, des bâtiments, des parts d’entreprises, ce qu’on lui doit. Seuls {cash} sont de l’argent disponible tout de suite : le reste est immobilisé.' },
      { label: 'À droite : {liabilities}', text: 'Les dettes de la ville, l’argent de départ qui lui a été donné, et son résultat. Les deux colonnes sont égales parce que chaque mouvement d’argent du journal est écrit des deux côtés.' },
      { when: 'loss', label: 'Perte : {result}', text: 'La ville a dépensé plus qu’elle n’a reçu depuis le début. La perte figure à gauche : c’est ce qui équilibre les colonnes.' },
      { when: 'gain', label: 'Résultat : {result}', text: 'La ville a reçu plus qu’elle n’a dépensé depuis le début.' },
    ],
  },
  'city.result.year': {
    about: 'le résultat de l’exercice',
    title: 'Résultat de l’exercice',
    message: {
      loss: 'La ville a perdu {result} cette année : ses dépenses (entretien, subventions, allocations, salaires) ont dépassé ses recettes (impôts, ventes, dividendes).',
      gain: 'La ville a gagné {result} cette année : ses recettes ont dépassé ses dépenses.',
    },
    figures: { result: 'euro' },
    states: LOSS_OR_GAIN,
    items: [{ fragment: 'notTreasury' }],
  },
  'city.result.previous': {
    about: 'les résultats des exercices précédents',
    title: 'Résultats des exercices précédents',
    message: {
      loss: 'Les années passées ont fait perdre {result} à la ville : ses dépenses ont dépassé ses recettes.',
      gain: 'Les années passées ont fait gagner {result} à la ville : ses recettes ont dépassé ses dépenses.',
    },
    figures: { result: 'euro' },
    states: LOSS_OR_GAIN,
    items: [{ fragment: 'notTreasury' }],
  },
  'city.result.total': {
    about: 'le résultat de la ville',
    title: 'Le résultat de la ville',
    message: {
      loss: 'Depuis le début de la partie, la ville a perdu {result} : ses dépenses (entretien, subventions, allocations, salaires) ont dépassé ses recettes (impôts, ventes, dividendes).',
      gain: 'Depuis le début de la partie, la ville a gagné {result} : ses recettes ont dépassé ses dépenses.',
    },
    figures: { result: 'euro' },
    states: LOSS_OR_GAIN,
    items: [
      { when: 'loss', label: 'Pourquoi à gauche ?', text: 'Une perte n’est pas un bien que la ville détient : elle est écrite à gauche pour que les deux colonnes du bilan soient égales.' },
      { fragment: 'notTreasury' },
    ],
  },
  'city.account.261': {
    about: 'les titres de participation',
    title: 'Titres de participation',
    message: 'La ville a mis {amount} dans le capital des entreprises qu’elle a fondées (capital de départ, aides). Cet argent n’est plus en caisse : il est devenu des parts d’entreprises.',
    figures: { amount: 'euro' },
    items: [
      { label: 'Quand redevient-il de l’argent ?', text: 'Par les dividendes que les entreprises versent chaque janvier à leurs actionnaires, ou si la ville vend ses parts à la société immobilière (fiche de l’entreprise, « Aide de la ville »).' },
      { label: 'Le risque', text: 'Si une entreprise est liquidée, la ville récupère ce qu’elle a prêté avant tout ; le capital restant est perdu.' },
    ],
  },
  'city.account.1021': {
    about: 'les dotations',
    title: 'Dotations',
    message: 'Les {amount} que la ville a reçus à sa fondation : l’argent de départ, créé pour elle par sa banque centrale. Ce n’est pas une dette : personne ne le réclame.',
    figures: { amount: 'euro' },
    items: [{ label: 'Pourquoi à droite ?', text: 'Parce que le bilan montre d’où vient ce que la ville détient. Cet argent a pu être dépensé ou placé : il reste inscrit ici comme origine.' }],
  },
  // The compte de résultat, and the balance of the accounts.
  'city.incomeStatement': {
    about: 'le compte de résultat',
    title: 'Lire le compte de résultat',
    message: 'Le compte de résultat raconte l’année : à gauche ce que la ville a dépensé (les charges), à droite ce qu’elle a reçu (les produits). La différence est le résultat de l’année.',
    figures: { charges: 'euro', products: 'euro', result: 'euro' },
    states: ['deficit', 'excess'],
    items: [
      { label: 'Charges : {charges}', text: 'Salaires, entretien, subventions, intérêts : tout ce qui est sorti de la caisse de la ville, ou qu’elle doit.' },
      { label: 'Produits : {products}', text: 'Impôts, ventes, dividendes, dotations : tout ce qui est entré, ou qu’on lui doit.' },
      { when: 'deficit', label: 'Déficit : {result}', text: 'Les charges dépassent les produits : la ville s’appauvrit cette année. Le déficit est ajouté côté produits pour que les deux colonnes soient égales.' },
      { when: 'excess', label: 'Excédent : {result}', text: 'Les produits dépassent les charges : la ville s’enrichit cette année. L’excédent est ajouté côté charges pour que les deux colonnes soient égales.' },
      { label: 'Un investissement n’est pas une charge', text: 'Le capital mis dans une entreprise, ou un prêt qu’on lui fait, est un placement : il ne figure pas ici mais au bilan.' },
    ],
  },
  'city.trialBalance': {
    about: 'la balance des comptes',
    title: 'Lire la balance',
    message: 'La balance liste chaque compte de la ville avec tout ce qui y a été débité et crédité depuis le début. C’est le contrôle de la comptabilité : le total des débits est toujours égal au total des crédits.',
    items: [
      { label: 'Débit et crédit', text: 'Ce ne sont ni des gains ni des pertes. Un débit est une écriture à gauche d’un compte, un crédit une écriture à droite ; chaque mouvement d’argent est écrit des deux côtés.' },
      { label: 'Solde', text: 'La différence entre les débits et les crédits d’un compte : débiteur s’il y a plus de débits, créditeur sinon.' },
    ],
  },
  // The global indices of the economy panel (EconomyPanel.js).
  'economy.gdp': {
    about: 'le PIB',
    title: 'Le produit intérieur brut (PIB)',
    message: 'Le PIB mesure ce que l’économie de la ville produit en une année : ce que les entreprises ajoutent aux biens qu’elles achètent (leur valeur ajoutée), plus l’administration de la ville comptée à son coût (ses salaires). Il vaut {gdp}.',
    figures: { gdp: 'euro' },
    items: [
      { label: 'À quoi il sert', text: 'Il mesure la taille de l’économie, et c’est la base de ce que les prêteurs acceptent de prêter à la ville : sa dette est plafonnée à une part du PIB.' },
      { fragment: 'perYear' },
    ],
  },
  'economy.gdpPpp': {
    about: 'le PIB en parité de pouvoir d’achat',
    title: 'Le PIB en parité de pouvoir d’achat (PPA)',
    message: 'Le PIB en PPA corrige le PIB par les prix : il se demande ce que les habitants peuvent réellement acheter. Il est égal au PIB multiplié par le prix d’un panier de référence ailleurs, divisé par son prix ici.',
    items: [
      { label: 'Lecture', text: 'Si tout est moins cher ici qu’ailleurs, le PIB en PPA est plus grand que le PIB : un euro y achète plus. Il sert de revenu à l’indice de développement humain.' },
      { label: 'Tant qu’il n’y a pas de marché', text: 'On ne peut pas comparer des prix qui n’existent pas encore : le chiffre attend un marché plutôt que d’être deviné.' },
    ],
  },
  'economy.gni': {
    about: 'le PNB',
    title: 'Le produit national brut (PNB)',
    message: 'Le PNB est ce qui reste vraiment aux habitants : le PIB, moins les intérêts que la ville et ses entreprises ont versés hors du jeu ({interest} cette année).',
    figures: { interest: 'euro' },
    items: [{ label: 'Pourquoi cette différence', text: 'Un prêt venu de l’étranger rapporte des intérêts à un prêteur qui n’est pas dans la ville : cet argent sort de l’économie. Un prêt d’une banque du jeu garde ses intérêts à l’intérieur.' }],
  },
  'economy.debt': {
    about: 'la dette publique et son plafond',
    title: 'La dette de la ville et son plafond',
    message: {
      room: 'La dette brute de la ville (prêts, découvert, fournisseurs impayés) est de {gross}. Les prêteurs plafonnent la dette à {ceiling} : il reste {headroom} à emprunter.',
      ceiling: 'La dette brute de la ville (prêts, découvert, fournisseurs impayés) est de {gross}, au plafond de {ceiling} que les prêteurs acceptent : plus personne ne lui prête.',
    },
    figures: { gross: 'euro', ceiling: 'euro', headroom: 'euro' },
    states: ['room', 'ceiling'],
    items: [
      { label: 'Brute et nette', text: 'La dette brute est tout ce que la ville doit. La dette nette en retire ce qu’elle détient et peut récupérer (trésorerie, créances, prêts aux entreprises) : négative, la ville est créancière nette. Les participations ne sont pas retirées, car elles ne sont pas liquides.' },
      { label: 'Du PIB', text: 'La colonne « Du PIB » compare chaque dette à ce que produit l’économie : une même dette pèse moins pour une ville qui produit plus.' },
      { when: 'ceiling', label: 'Pour reprendre l’emprunt', text: 'Rembourser des prêts, ou faire grandir l’économie : le plafond suit le PIB des douze derniers mois.' },
    ],
  },
  'economy.hdi': {
    about: 'l’indice de développement humain',
    title: 'L’indice de développement humain (IDH)',
    message: {
      valid: 'L’IDH de la ville est de {hdi}, sur une échelle de 0 à 1. C’est la moyenne géométrique de trois dimensions : la santé, l’éducation et le revenu.',
      invalid: 'L’IDH n’est pas encore calculable : il faut que chacune de ses trois dimensions (santé, éducation, revenu) dépasse 0.',
    },
    figures: { hdi: 'index' },
    states: ['valid', 'invalid'],
    items: [
      { label: 'Pourquoi une moyenne géométrique', text: 'Une dimension très basse tire tout l’indice vers le bas : on ne compense pas une ville sans école par beaucoup de revenu.' },
      { label: 'Ce que le jeu mesure', text: 'Le jeu n’a ni espérance de vie ni années d’école : la santé est dite par la faim et les soins, l’éducation par l’école primaire, l’école et la bibliothèque, le revenu par le PIB en PPA par habitant.' },
    ],
  },
  // What a building shows of itself (the État tab of its sheet): the same text for every building, the figures its own.
  'building.solidity': {
    about: 'la solidité du bâtiment',
    title: 'La solidité',
    message: {
      sound: 'Le bâtiment est solide ({percent}) : il est bien entretenu.',
      warning: 'Le bâtiment est fragilisé ({percent}) : sans entretien, il risque de s’effondrer dans les mois qui viennent.',
      'at-risk': 'Le bâtiment est en danger ({percent}) : il peut s’effondrer à tout moment.',
    },
    figures: { percent: 'percent', wear: 'percent', warningBelow: 'percent', riskBelow: 'percent', chance: 'percent', casualty: 'percent' },
    states: ['sound', 'warning', 'at-risk'],
    items: [
      { label: 'Comment elle baisse', text: 'Chaque mois, un bâtiment perd {wear} de solidité. Si son entretien est payé ce mois-là, la perte est annulée ; s’il ne l’est pas, elle reste. L’entretien d’un bâtiment public est payé par la ville : un Trésor vide laisse tout s’user.' },
      { label: 'Les seuils', text: 'Sous {warningBelow}, le bâtiment porte une alerte. Sous {riskBelow}, il peut s’effondrer chaque mois, avec un risque qui monte jusqu’à {chance} à zéro.' },
      { label: 'Un effondrement', text: 'Le bâtiment est démoli comme si vous l’aviez fait, et {casualty} des personnes qui s’y trouvent meurent.' },
      { when: 'sound', label: 'Rien à faire', text: 'Tant que l’entretien est payé, la barre reste pleine.' },
      { when: 'warning', label: 'À faire maintenant', text: 'Payer l’entretien : la barre cesse de baisser. Elle ne remonte pas : il n’existe pas encore de réparation.' },
      { when: 'at-risk', label: 'À faire maintenant', text: 'Payer l’entretien arrête l’usure mais ne répare pas : le risque d’effondrement reste. Il faut démolir et reconstruire avant qu’il ne s’effondre de lui-même.' },
    ],
  },
  // The Patrimoine section.
  'city.ownership.claims': {
    about: 'les dettes et créances',
    title: 'Dettes et créances',
    message: 'Chaque ligne est une somme due, vue des deux côtés : le créancier est celui à qui on doit, le débiteur celui qui doit. Une même dette est la créance de l’un et la dette de l’autre.',
    items: [
      { label: 'Les vues', text: '« Ce que la ville doit » ne garde que les dettes dont la ville est débitrice, « Ce qu’on doit à la ville » que celles dont elle est créancière.' },
      { label: 'Un loyer impayé', text: 'Une entreprise qui ne peut pas payer son loyer ne le perd pas : il devient une dette, réglée plus tard quand elle a l’argent.' },
    ],
  },
  'city.ownership.shareholders': {
    about: 'les actionnaires',
    title: 'Les entreprises et leurs actionnaires',
    message: 'Chaque entreprise a un capital, réparti en parts. Qui détient des parts touche la part correspondante des dividendes, versés chaque janvier.',
    items: [{ label: 'Part du capital, part des dividendes', text: 'La part du capital est ce qu’on détient ; la part des dividendes est ce qu’on touche. Elles diffèrent quand du capital a été apporté sans donner de parts (une participation).' }],
  },
});

/**
 * The entry of a line of the city's books, told by its account, or null when the line is plain and has no help.
 * @param {string} account
 * @returns {string | null} the id of the entry in `HELP`
 */
export function helpIdOfAccount(account) {
  const id = `city.account.${account}`;
  return Object.hasOwn(HELP, id) ? id : null;
}
