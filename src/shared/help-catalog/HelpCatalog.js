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
/** @typedef {{ label: HelpText, text: HelpText, when?: string | ReadonlyArray<string> } | { fragment: string }} HelpItem an item, or the name of a `FRAGMENTS` item shared by several entries (it names no figure) */
/** @typedef {{ about: string, title: string, message: HelpText, items?: ReadonlyArray<HelpItem>, figures?: Readonly<Record<string, 'euro' | 'percent' | 'index' | 'count'>>, states?: ReadonlyArray<string> }} HelpEntry */

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
    message: 'Le **bilan** est une photo de la ville aujourd’hui.\n\nIl a **deux colonnes qui valent toujours la même somme** : à gauche ce que la ville **détient**, à droite **d’où cela vient** (ce qu’elle doit, l’argent qu’on lui a donné, ce qu’elle a gagné ou perdu).',
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
      loss: 'La ville a **perdu** {result} cette année.\n\nSes **dépenses** (entretien, subventions, allocations, salaires) ont dépassé ses **recettes** (impôts, ventes, dividendes).',
      gain: 'La ville a **gagné** {result} cette année.\n\nSes **recettes** ont dépassé ses **dépenses**.',
    },
    figures: { result: 'euro' },
    states: LOSS_OR_GAIN,
    items: [{ fragment: 'notTreasury' }],
  },
  'city.result.previous': {
    about: 'les résultats des exercices précédents',
    title: 'Résultats des exercices précédents',
    message: {
      loss: 'Les années passées ont fait **perdre** {result} à la ville.\n\nSes **dépenses** ont dépassé ses **recettes**.',
      gain: 'Les années passées ont fait **gagner** {result} à la ville.\n\nSes **recettes** ont dépassé ses **dépenses**.',
    },
    figures: { result: 'euro' },
    states: LOSS_OR_GAIN,
    items: [{ fragment: 'notTreasury' }],
  },
  'city.result.total': {
    about: 'le résultat de la ville',
    title: 'Le résultat de la ville',
    message: {
      loss: 'Depuis le début de la partie, la ville a **perdu** {result}.\n\nSes **dépenses** (entretien, subventions, allocations, salaires) ont dépassé ses **recettes** (impôts, ventes, dividendes).',
      gain: 'Depuis le début de la partie, la ville a **gagné** {result}.\n\nSes **recettes** ont dépassé ses **dépenses**.',
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
    message: 'La ville a mis {amount} dans le **capital des entreprises** qu’elle a fondées (capital de départ, aides).\n\nCet argent **n’est plus en caisse** : il est devenu des **parts d’entreprises**.',
    figures: { amount: 'euro' },
    items: [
      { label: 'Quand redevient-il de l’argent ?', text: 'Par les dividendes que les entreprises versent chaque janvier à leurs actionnaires, ou si la ville vend ses parts à la société immobilière (fiche de l’entreprise, « Aide de la ville »).' },
      { label: 'Le risque', text: 'Si une entreprise est liquidée, la ville récupère ce qu’elle a prêté avant tout ; le capital restant est perdu.' },
    ],
  },
  'city.account.1021': {
    about: 'les dotations',
    title: 'Dotations',
    message: 'Les {amount} que la ville a reçus à sa fondation : l’**argent de départ**, créé pour elle par sa banque centrale.\n\nCe **n’est pas une dette** : personne ne le réclame.',
    figures: { amount: 'euro' },
    items: [{ label: 'Pourquoi à droite ?', text: 'Parce que le bilan montre d’où vient ce que la ville détient. Cet argent a pu être dépensé ou placé : il reste inscrit ici comme origine.' }],
  },
  // The compte de résultat, and the balance of the accounts.
  'city.incomeStatement': {
    about: 'le compte de résultat',
    title: 'Lire le compte de résultat',
    message: 'Le **compte de résultat** raconte l’année.\n\nÀ gauche ce que la ville a **dépensé** (les **charges**), à droite ce qu’elle a **reçu** (les **produits**). La différence est le **résultat** de l’année.',
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
    message: 'La **balance** liste chaque compte de la ville avec tout ce qui y a été débité et crédité depuis le début.\n\nC’est le **contrôle** de la comptabilité : le total des débits est toujours **égal** au total des crédits.',
    items: [
      { label: 'Débit et crédit', text: 'Ce ne sont ni des gains ni des pertes. Un débit est une écriture à gauche d’un compte, un crédit une écriture à droite ; chaque mouvement d’argent est écrit des deux côtés.' },
      { label: 'Solde', text: 'La différence entre les débits et les crédits d’un compte : débiteur s’il y a plus de débits, créditeur sinon.' },
    ],
  },
  // The global indices of the economy panel (EconomyPanel.js).
  'economy.gdp': {
    about: 'le PIB',
    title: 'Le produit intérieur brut (PIB)',
    message: 'Le **PIB** mesure ce que l’économie de la ville **produit en une année** : {gdp}.\n\nIl additionne ce que les entreprises ajoutent aux biens qu’elles achètent (leur **valeur ajoutée**) et l’**administration** de la ville, comptée à son coût (ses salaires).',
    figures: { gdp: 'euro' },
    items: [
      { label: 'À quoi il sert', text: 'Il mesure la taille de l’économie, et c’est la base de ce que les prêteurs acceptent de prêter à la ville : sa dette est plafonnée à une part du PIB.' },
      { fragment: 'perYear' },
    ],
  },
  'economy.gdpPpp': {
    about: 'le PIB en parité de pouvoir d’achat',
    title: 'Le PIB en parité de pouvoir d’achat (PPA)',
    message: 'Le **PIB en PPA** corrige le PIB par les **prix** : il se demande ce que les habitants peuvent réellement **acheter**.\n\nIl est égal au PIB multiplié par le prix d’un panier de référence ailleurs, divisé par son prix ici.',
    items: [
      { label: 'Lecture', text: 'Si tout est moins cher ici qu’ailleurs, le PIB en PPA est plus grand que le PIB : un euro y achète plus. Il sert de revenu à l’indice de développement humain.' },
      { label: 'Tant qu’il n’y a pas de marché', text: 'On ne peut pas comparer des prix qui n’existent pas encore : le chiffre attend un marché plutôt que d’être deviné.' },
    ],
  },
  'economy.gni': {
    about: 'le PNB',
    title: 'Le produit national brut (PNB)',
    message: 'Le **PNB** est ce qui reste **vraiment aux habitants** : le PIB, moins les **intérêts versés hors du jeu** par la ville et ses entreprises ({interest} cette année).',
    figures: { interest: 'euro' },
    items: [{ label: 'Pourquoi cette différence', text: 'Un prêt venu de l’étranger rapporte des intérêts à un prêteur qui n’est pas dans la ville : cet argent sort de l’économie. Un prêt d’une banque du jeu garde ses intérêts à l’intérieur.' }],
  },
  'economy.debt': {
    about: 'la dette publique et son plafond',
    title: 'La dette de la ville et son plafond',
    message: {
      room: 'La **dette brute** de la ville (prêts, découvert, fournisseurs impayés) est de {gross}.\n\nLes prêteurs plafonnent la dette à {ceiling} : il reste {headroom} à **emprunter**.',
      ceiling: 'La **dette brute** de la ville (prêts, découvert, fournisseurs impayés) est de {gross}.\n\nElle est **au plafond** de {ceiling} que les prêteurs acceptent : plus personne ne lui prête.',
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
      valid: 'L’**IDH** de la ville est de {hdi}, sur une échelle de 0 à 1.\n\nC’est la **moyenne géométrique** de trois dimensions : la **santé**, l’**éducation** et le **revenu**.',
      invalid: 'L’**IDH** n’est **pas encore calculable**.\n\nIl faut que chacune de ses trois dimensions (**santé**, **éducation**, **revenu**) dépasse 0.',
    },
    figures: { hdi: 'index' },
    states: ['valid', 'invalid'],
    items: [
      { label: 'Pourquoi une moyenne géométrique', text: 'Une dimension très basse tire tout l’indice vers le bas : on ne compense pas une ville sans école par beaucoup de revenu.' },
      { label: 'Ce que le jeu mesure', text: 'Le jeu n’a ni espérance de vie ni années d’école : la santé est dite par la faim et les soins, l’éducation par l’école primaire, l’école et la bibliothèque, le revenu par le PIB en PPA par habitant.' },
    ],
  },
  // The central bank's panel (initCentralBankSection.js): money, the levers of the federation and the bank's health.
  'bank.policyRate': {
    about: 'le taux directeur',
    title: 'Le taux directeur',
    message: 'Le **taux directeur** ({rate} par an) est le **prix de base de l’argent** dans toute la fédération.\n\nLa banque centrale s’en sert pour prêter à la banque, et **tous les autres taux s’y accrochent**.',
    figures: { rate: 'percent', marginalSpread: 'percent', depositSpread: 'percent' },
    items: [
      { label: 'Le couloir de taux', text: 'La banque centrale prête à la banque au taux directeur (refinancement), {marginalSpread} de plus en urgence (prêt marginal), et rémunère ses réserves excédentaires {depositSpread} de moins (facilité de dépôt).' },
      { label: 'Ce que le joueur ressent', text: 'Un taux plus haut renchérit les prêts à la ville et aux entreprises : on emprunte moins. Il fait mieux rémunérer l’épargne : les ménages placent davantage à la banque.' },
      { label: 'Un levier de la fédération', text: 'Il est le même pour tous les États, et ne peut être déplacé que tant que la banque centrale travaille (ses postes pourvus par nomination).' },
    ],
  },
  'bank.reserveRatio': {
    about: 'la réserve obligatoire',
    title: 'La réserve obligatoire',
    message: 'La **réserve obligatoire** : la banque doit garder {ratio} des dépôts de ses clients en réserve à la banque centrale.\n\nC’est de l’argent qu’elle **ne peut pas prêter**.',
    figures: { ratio: 'percent' },
    items: [
      { label: 'Si on la monte', text: 'La banque peut prêter moins pour un même montant de dépôts, et doit plus souvent se refinancer à la banque centrale.' },
      { label: 'Si on la baisse', text: 'La banque prête plus : plus de crédit possible, mais moins de marge si les clients retirent leur argent.' },
    ],
  },
  'bank.reservePosition': {
    about: 'les réserves de la banque',
    title: 'Les réserves de la banque',
    message: {
      ok: 'La banque détient {reserves} de **réserves** et doit en garder {required}.\n\nElle est **au-dessus** de la réserve obligatoire.',
      short: 'La banque ne détient que {reserves} de **réserves** pour {required} à garder.\n\nIl lui **manque** de quoi tenir la réserve obligatoire.',
    },
    figures: { reserves: 'euro', required: 'euro' },
    states: ['ok', 'short'],
    items: [
      { label: 'Ce que sont ses réserves', text: 'Son propre argent et celui de ses clients, déposé à la banque centrale. Un paiement d’un client à un autre ne les change pas ; un prêt accordé crée un dépôt et fait monter la réserve due.' },
      { when: 'short', label: 'Ce qui se passe', text: 'La banque centrale lui prête ce qui manque, contre garanties, au taux de refinancement. Sans garanties, sans banque centrale en activité ou avec des fonds propres trop faibles, le retrait ou le prêt est refusé.' },
    ],
  },
  'bank.capitalRatio': {
    about: 'les fonds propres de la banque',
    title: 'Fonds propres et prêts de la banque',
    message: {
      sound: 'Les **fonds propres** de la banque font {ratio} de ses prêts.\n\nAu-dessus de {warning}, le superviseur est **tranquille**.',
      warning: 'Les **fonds propres** de la banque font {ratio} de ses prêts.\n\nSous {warning}, le superviseur **avertit** la ville chaque mois. Sous {minimum}, il **gèlera ses prêts**.',
      frozen: 'Les **fonds propres** de la banque font {ratio} de ses prêts.\n\nSous le minimum de {minimum}, le superviseur a **gelé ses prêts**.',
      insolvent: 'La banque est **insolvable** : ses pertes dépassent son capital.',
    },
    figures: { ratio: 'percent', warning: 'percent', minimum: 'percent', cap: 'euro' },
    states: ['sound', 'warning', 'frozen', 'insolvent'],
    items: [
      { label: 'Pourquoi ce ratio', text: 'Les fonds propres sont ce qui absorbe les pertes de la banque quand un emprunteur ne rembourse pas. Plus elle a prêté, plus il lui en faut.' },
      { when: 'frozen', label: 'Ce que gèle le superviseur', text: 'Plus aucun prêt à la ville, plus aucun crédit aux entreprises, jusqu’à ce que la banque soit recapitalisée ou que ses prêts diminuent.' },
      { when: ['warning', 'frozen'], label: 'Ce qu’on peut faire', text: 'Recapitaliser : la ville apporte du capital à la banque, jusqu’au seuil d’alerte.' },
      { when: 'insolvent', label: 'Ce qu’on peut faire', text: 'Recapitaliser, ou liquider la banque : les prêts sont rappelés d’un coup, et la ville ne garantit chaque épargnant que jusqu’à {cap}.' },
    ],
  },
  'bank.corridor': {
    about: 'le couloir de taux',
    title: 'Le couloir de taux de la banque centrale',
    message: 'Trois taux **encadrent** le taux directeur : la **facilité de dépôt** ({deposit}), le **refinancement** ({main}) et le **prêt marginal** ({marginal}).',
    figures: { deposit: 'percent', main: 'percent', marginal: 'percent' },
    items: [
      { label: 'Facilité de dépôt', text: 'Ce que la banque centrale verse à la banque pour les réserves qu’elle garde au-delà de la réserve obligatoire : le plancher.' },
      { label: 'Refinancement', text: 'Ce que la banque paie pour l’argent que la banque centrale lui prête afin de tenir sa réserve en fin de mois : le taux directeur.' },
      { label: 'Prêt marginal', text: 'Ce que la banque paie pour un prêt d’urgence, quand il lui manque de l’argent pour un retrait ou un prêt : le plafond.' },
    ],
  },
  'bank.collateral': {
    about: 'les garanties de la banque',
    title: 'Les garanties de la banque',
    message: 'La banque centrale ne prête à la banque que **contre garanties** : ses propres prêts, diminués d’une **décote** de {haircut}.\n\nIl lui reste {capacity} de garanties à remettre.',
    figures: { capacity: 'euro', haircut: 'percent' },
    items: [{ label: 'Quand il n’y en a plus', text: 'La banque ne peut plus être refinancée : un retrait ou un prêt qu’elle ne peut pas payer avec ses réserves est refusé, et la ville ne peut plus emprunter.' }],
  },
  'bank.refinancing': {
    about: 'le refinancement dû',
    title: 'Le refinancement dû par la banque',
    message: 'La banque **doit** {owed} à la banque centrale : l’argent qu’elle lui a **emprunté** pour tenir sa réserve ou payer un retrait.',
    figures: { owed: 'euro' },
    items: [{ label: 'Comment elle le rembourse', text: 'Chaque mois, la banque paie d’abord les intérêts, puis rembourse avec ce qu’elle garde au-delà de sa réserve. Les intérêts qu’elle ne peut pas payer s’ajoutent à sa dette.' }],
  },
  'bank.savingShare': {
    about: 'la part du surplus mise de côté',
    title: 'La part du surplus mise de côté',
    message: 'Chaque mois, un ménage garde de quoi **vivre un mois**, puis **place à la banque** {share} de ce qu’il a en plus.',
    figures: { share: 'percent' },
    items: [
      { label: 'Ce qui la fait monter', text: 'Plus l’épargne rapporte, plus la part est grande : c’est le chemin par lequel le taux directeur atteint les ménages.' },
      { label: 'Quand il manque', text: 'Un ménage puise dans son épargne quand il lui manque de quoi vivre. Un ménage endetté rembourse avant d’épargner.' },
    ],
  },
  'bank.companyCredit': {
    about: 'le crédit aux entreprises',
    title: 'Le crédit aux entreprises',
    message: 'Une entreprise **à court de trésorerie** pour payer son mois **emprunte ce qui manque** à la banque, au taux de {rate} par an.\n\nPlafond : {months} mois de ses charges.',
    figures: { rate: 'percent', months: 'count' },
    items: [
      { label: 'Plus il est cher, moins on emprunte', text: 'Quand le taux monte, une entreprise emprunte une part plus faible de son plafond.' },
      { label: 'Au-delà', text: 'Ce que l’entreprise ne peut pas emprunter devient une dette envers son créancier (salaires, impôts, loyer), réglée quand elle a l’argent.' },
      { label: 'Banque gelée', text: 'Si le superviseur a gelé les prêts de la banque, aucune entreprise n’emprunte.' },
    ],
  },
  // The taxes of the city (TaxesSectionPresenter.js). Every tax is levied only while someone holds its collection: the state says which.
  'tax.citizen': {
    about: 'l’impôt par citoyen',
    title: 'L’impôt par citoyen',
    message: {
      collected: 'Chaque **novembre**, la ville prélève {amount} **par habitant** sur les maisons de **niveau 2 et plus**.\n\nLes maisons de niveau 1, qui vivent encore de leur terre, sont **exonérées**.',
      uncollected: 'Personne ne perçoit l’impôt par citoyen : il **n’est pas levé**.\n\nL’avis au-dessus de la ligne dit qui peut le percevoir.',
    },
    figures: { amount: 'euro' },
    states: ['collected', 'uncollected'],
    items: [
      { when: 'collected', label: 'Une fois par an', text: 'Il est levé en novembre, d’un seul coup : la caisse de la ville se remplit à ce moment, pas au fil des mois.' },
      { when: 'collected', label: 'L’effet', text: 'Plus il est haut, plus la ville encaisse, et moins il reste aux ménages. Seuls les statuts que le catalogue taxe le paient.' },
    ],
  },
  'tax.corporate': {
    about: 'l’impôt sur les sociétés',
    title: 'L’impôt sur les sociétés (IS)',
    message: {
      collected: 'Chaque entreprise paie {rate} de son **résultat de l’année avant impôt**.\n\nUne entreprise qui **perd** de l’argent ne paie **rien**.',
      uncollected: 'Personne ne perçoit l’impôt sur les sociétés : il **n’est pas levé**.\n\nL’avis au-dessus de la ligne dit qui peut le percevoir.',
    },
    figures: { rate: 'percent' },
    states: ['collected', 'uncollected'],
    items: [
      { when: 'collected', label: 'Une fois par an', text: 'Il est réglé à la clôture de l’année, sur le résultat courant de l’année qui s’achève. Une entreprise qui n’a pas l’argent le doit : l’impôt devient une dette, payée plus tard.' },
      { when: 'collected', label: 'L’effet', text: 'Un taux haut remplit la caisse de la ville, mais réduit ce qui reste aux entreprises pour grandir, rembourser leurs prêts et verser des dividendes.' },
    ],
  },
  'tax.income': {
    about: 'l’impôt sur le revenu',
    title: 'L’impôt sur le revenu (IR)',
    message: {
      collected: 'L’impôt sur le revenu est **progressif**, par tranches, sur le revenu **du mois** :\n\n- **Rien** jusqu’à {threshold1}\n- {rate1} sur la part entre {threshold1} et {threshold2}\n- {rate2} sur la part au-delà de {threshold2}',
      uncollected: 'Personne ne perçoit l’impôt sur le revenu : il **n’est pas levé**.\n\nL’avis au-dessus de la ligne dit qui peut le percevoir.',
    },
    figures: { threshold1: 'euro', rate1: 'percent', threshold2: 'euro', rate2: 'percent' },
    states: ['collected', 'uncollected'],
    items: [
      { when: 'collected', label: 'Chaque tranche ne taxe que sa part', text: 'Un revenu au-dessus du second seuil n’est pas taxé en entier au second taux : seule la part au-dessus du seuil l’est.' },
      { when: 'collected', label: 'Retenu à la source', text: 'Chaque employeur (et la ville pour ses propres versements) retient l’impôt sur la paie avant de la verser. Un ménage qui touche de plusieurs payeurs est taxé sur le total de ses revenus du mois.' },
      { when: 'collected', label: 'L’effet', text: 'Il pèse sur le revenu des ménages donc sur ce qu’ils dépensent et épargnent ; il ne touche pas les ménages sous le premier seuil.' },
    ],
  },
  'tax.vat': {
    about: 'la TVA',
    title: 'La taxe sur la valeur ajoutée (TVA)',
    message: {
      uniform: 'La **TVA** s’ajoute au **prix hors taxe** de chaque vente aux maisons, au **même taux** de {rate} pour tous les produits.',
      byCategory: 'La **TVA** s’ajoute au **prix hors taxe** de chaque vente aux maisons, à un **taux propre à chaque catégorie** de produits.',
      uncollected: 'Personne ne perçoit la TVA : elle **n’est pas levée**.\n\nL’avis au-dessus de la ligne dit qui peut la percevoir.',
    },
    figures: { rate: 'percent' },
    states: ['uniform', 'byCategory', 'uncollected'],
    items: [
      { when: ['uniform', 'byCategory'], label: 'Sur la dernière vente', text: 'La TVA porte sur la dernière vente d’un bien ou d’une prestation aux maisons. Le prix hors taxe est celui du vendeur, y compris la part de la ville ; la TVA s’y ajoute pour former le prix toutes taxes comprises.' },
      { when: ['uniform', 'byCategory'], label: 'Une subvention ne la réduit pas', text: 'Une subvention directement liée au prix d’une prestation fait partie de la base imposable.' },
      { when: ['uniform', 'byCategory'], label: 'Exonérer', text: 'Cocher « exonéré » retire la TVA de ce bien ou de cette prestation, quel que soit le taux de sa catégorie.' },
      { when: 'uniform', label: 'Un seul taux', text: 'Décocher « même taux pour tous les produits » permet de régler un taux par catégorie.' },
    ],
  },
  // What a building shows of itself (the État tab of its sheet): the same text for every building, the figures its own.
  'building.solidity': {
    about: 'la solidité du bâtiment',
    title: 'La solidité',
    message: {
      sound: 'Le bâtiment est **solide** ({percent}) : il est bien entretenu.',
      warning: 'Le bâtiment est **fragilisé** ({percent}).\n\nSans entretien, il **risque de s’effondrer** dans les mois qui viennent.',
      'at-risk': 'Le bâtiment est **en danger** ({percent}).\n\nIl peut **s’effondrer à tout moment**.',
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
    message: 'Chaque ligne est une **somme due**, vue des deux côtés.\n\nLe **créancier** est celui à qui on doit, le **débiteur** celui qui doit. Une même dette est la créance de l’un et la dette de l’autre.',
    items: [
      { label: 'Les vues', text: '« Ce que la ville doit » ne garde que les dettes dont la ville est débitrice, « Ce qu’on doit à la ville » que celles dont elle est créancière.' },
      { label: 'Un loyer impayé', text: 'Une entreprise qui ne peut pas payer son loyer ne le perd pas : il devient une dette, réglée plus tard quand elle a l’argent.' },
    ],
  },
  'city.ownership.shareholders': {
    about: 'les actionnaires',
    title: 'Les entreprises et leurs actionnaires',
    message: 'Chaque entreprise a un **capital**, réparti en **parts**.\n\nQui détient des parts touche la part correspondante des **dividendes**, versés chaque **janvier**.',
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
