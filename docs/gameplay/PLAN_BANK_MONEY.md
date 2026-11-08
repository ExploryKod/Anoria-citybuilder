# Plan : la monnaie réelle — des États, une banque centrale fédérale, des dépôts (2026-11-08)

## Pourquoi

L'audit du 2026-11-08 (« avons-nous un système bancaire réaliste ? ») a montré que la comptabilité et les institutions sont justes, mais pas la monnaie :

- **l'argent des ménages et des entreprises ne vient de nulle part.** Leur 512 (« Banques ») est, au plan comptable, de l'argent déposé à une banque ; mais
  aucune banque ne le doit à personne. Dans la réalité, cet argent **est** la dette de la banque envers ses clients (les dépôts), et c'est presque toute la
  monnaie en circulation ;
- **la banque prête l'argent qu'elle a en caisse.** Dans la réalité, elle prête en **créditant le compte** de l'emprunteur : le prêt crée le dépôt. Elle n'a
  besoin de monnaie de banque centrale (ses **réserves**) que pour régler ce qui sort de chez elle et pour la réserve obligatoire ;
- **ses réserves sont son propre 512.** Dans la réalité, ce sont des **comptes à la banque centrale** (à la Banque de France, dans T2 pour la zone euro).

## Décisions (du joueur, 2026-11-08)

- **Chaque hameau est un État**, au sens d'un pays (pas d'un État fédéré américain) ; **tous les hameaux ensemble forment une fédération**.
- **Une seule monnaie, une banque centrale fédérale**, sur le modèle de la zone euro : la banque centrale fédérale (la BCE) fixe **un** taux directeur et
  **une** réserve obligatoire pour toute la fédération ; la banque centrale de chaque État (la Banque de France) mène les opérations, tient les comptes des banques
  de son État et celui de son Trésor, et reverse son résultat à son État.
- **Le Trésor de chaque État a son compte à sa banque centrale**, comme le Trésor français à la Banque de France.
- **La fédération ne fait, pour l'instant, que l'union douanière** (un tarif douanier commun, comme aujourd'hui : « Anoria »). Ni budget fédéral, ni libre
  circulation des ménages et des entreprises entre États.

## Ce que cela change

### 1. Les trois monnaies

| Monnaie | Dette de qui | Détenue par |
|---|---|---|
| Les billets | la banque centrale de l'État | tous (la caisse, 53) |
| Les réserves (compte à la banque centrale) | la banque centrale de l'État | la banque et le Trésor de l'État |
| Les dépôts (compte à la banque) | la banque | les ménages et les entreprises (leur 512) |

### 2. Ce qui ne change pas : le côté des clients

Le 512 d'un ménage ou d'une entreprise **est déjà** un compte en banque, au plan comptable. Leurs écritures ne changent pas. Un salaire payé par une entreprise
à un ménage, deux clients de la même banque, est un **transfert entre deux dépôts** : le total des dépôts ne bouge pas, la banque n'a rien à écrire.

### 3. Ce qui change : le côté de la banque

Son bilan devient celui d'une vraie banque :

| Actif | Passif |
|---|---|
| prêts (à l'État, aux entreprises) | **dépôts à vue de ses clients** (la somme de leurs 512) |
| **réserves à la banque centrale** | refinancement de la banque centrale (1649) |
| billets en caisse (peu) | comptes d'épargne (165) |
| | capital et résultats |

Les **réserves ne bougent que quand l'argent franchit la frontière de la banque** : l'État paie un ménage ou encaisse un impôt (son compte est à la banque centrale),
la banque centrale refinance la banque ou est remboursée, un ménage retire des billets. Un prêt aux entreprises ne prend plus de réserves : il crée un dépôt.

### 4. Ce qui change : l'État

- Le compte de l'État (aujourd'hui le compte sans bâtiment, le 512 du M57) devient **son compte au Trésor, à sa banque centrale** (le 515 du M57, « compte au
  Trésor »). Chaque paiement de l'État à un client de la banque, ou d'un client à l'État, fait passer des réserves de son compte à celui de la banque.
- **Le plan comptable de l'État.** Le jeu tient les comptes de la ville au M57, le plan des collectivités locales. Un État tient le **plan comptable de l'État**
  (le recueil des normes comptables de l'État). À décider : garder le M57 (ses intitulés suffisent au jeu) ou passer aux comptes de l'État.

### 5. La fédération

- **La banque centrale fédérale** n'est pas un bâtiment d'un État : comme la douane « Anoria », c'est une institution de la fédération. Elle fixe le taux directeur
  et la réserve obligatoire, que le joueur règle aujourd'hui par hameau : **ces deux leviers deviennent fédéraux** (un seul réglage pour tous les hameaux).
- **Les banques centrales des États** (le bâtiment `CentralBank`, une par hameau) refinancent leurs banques au taux fédéral, tiennent les comptes de leur Trésor et
  de leurs banques, et reversent leur résultat à leur État (comme aujourd'hui).
- **Pas de flux entre États pour l'instant** : seul le hameau visité est simulé (le règlement du mois ne lit que lui, voir `multiple_hamlet.md`), et il n'y a pas
  de libre circulation. Les paiements entre États (les soldes TARGET entre banques centrales) viendront avec le commerce ou la libre circulation.

## Questions tranchées (2026-11-08)

Le joueur a retenu toutes les recommandations :

| # | Question | Décision |
|---|---|---|
| 1 | Qui règle les leviers fédéraux | Le joueur, dès qu'une banque centrale d'État fonctionne ; sinon le catalogue |
| 2 | Un État sans banque centrale bâtie | **La banque centrale de l'État existe dès la fondation, comme institution sans bâtiment** (comme la douane) : le compte du Trésor y est tenu tout de suite. Le bâtiment `CentralBank` ouvre le guichet : il permet le refinancement, et son personnel donne à l'État sa voix sur les leviers fédéraux |
| 3 | Un État sans banque commerciale | **Les billets** : l'argent des ménages et des entreprises est en billets (53, dette de la banque centrale de l'État) ; à l'ouverture de la banque, ils y déposent leurs billets |
| 3b | D'où vient la monnaie de départ | **Créée une fois par la banque centrale de l'État, à la fondation** (la dotation d'un pays neuf), puis plus jamais : l'État ne dépense ensuite que ce qu'il encaisse ou emprunte (pas d'avance au Trésor, comme dans la zone euro ; à garder comme outil de crise pour plus tard) |
| 4 | Les comptes | La banque : ses réserves à la banque centrale **5151** (actif). La banque centrale : les réserves des banques **1673** et le compte du Trésor **1674** (ses dettes). L'État : sa trésorerie passe du 512 au **515 « compte au Trésor »** du M57 |
| 5 | Dépôts écrits ou dérivés | **Écrits** : chaque écriture qui touche la banque porte une jambe « dépôts » ; un paiement entre deux clients n'écrit rien (le total ne bouge pas) ; un test vérifie que les dépôts de la banque égalent la somme des 512 de ses clients |
| 6 | L'épargne | **Un livret** à côté du compte courant : les deux sont des dépôts, seul le livret rapporte ; passer de l'un à l'autre ne bouge aucune réserve |
| 7 | Le prefab | **Des écritures d'ouverture écrites dans son JSON**, générées une fois depuis ses soldes actuels puis figées (pas de migration au chargement) |

## Les questions telles qu'elles étaient posées

1. **Qui règle les leviers fédéraux, et quand ?** Le conseil de la banque centrale fédérale, ce sont les banques centrales des États. Proposition : le joueur règle
   le taux et la réserve **quand au moins une banque centrale d'État fonctionne** ; sinon les valeurs du catalogue s'appliquent, comme aujourd'hui.
2. **Un État sans banque.** Sans banque, il n'y a pas de dépôts. Proposition : les ménages et les entreprises d'un État sans banque tiennent leur argent en
   **billets** (53, la dette de la banque centrale de l'État) ; quand la banque ouvre, ils y déposent leurs billets. Il faut alors aussi décider ce qu'est un État
   **sans banque centrale** (son Trésor a besoin d'un compte dès le premier jour : la banque centrale existerait d'office, le bâtiment servant à ses opérations).
3. **D'où vient la monnaie de départ.** Les fonds de départ de la ville (1021) et ce qu'elle verse aux entreprises viennent aujourd'hui de nulle part. Proposition : la
   banque centrale de l'État les **crée** au départ, en contrepartie d'une dotation de l'État (comme une monnaie émise lors de la fondation de l'État), puis plus jamais :
   ensuite l'État ne dépense que ce qu'il encaisse ou emprunte (l'avance de la banque centrale au Trésor est interdite dans la zone euro).
4. **Le compte des réserves.** Un compte pour les réserves de la banque à sa banque centrale (côté banque) et pour les comptes que tient la banque centrale (côté banque
   centrale : les réserves des banques et le compte du Trésor sont ses dettes). Les numéros sont à fixer, comme le 1678 de la monnaie émise.
5. **Dérivé ou écrit ?** Les dépôts de la banque sont la somme des 512 de ses clients : on peut les **lire** du pli du journal sans rien écrire. Mais alors les écritures
   de la banque ne se suffisent plus à elles-mêmes (sa contrepartie de dépôts n'est pas une jambe). Deux voies : (a) les dépôts sont une ligne du bilan de la banque
   **dérivée** des comptes de ses clients, et seules les entrées et sorties de réserves sont écrites ; (b) la banque écrit une jambe « dépôts » pour chaque mouvement
   qui la touche (prêt, intérêts, ses propres salaires, les flux de l'État), et un test vérifie qu'elle égale la somme des 512 de ses clients. Recommandation : (b), la
   partie double reste vraie écriture par écriture.
6. **L'épargne.** Les comptes d'épargne (275 / 165) deviennent un livret à côté du compte courant : les deux sont des dépôts, seul le livret rapporte. Le
   mouvement du compte courant vers le livret ne fait alors bouger aucune réserve.
7. **Le prefab.** Le prefab de départ porte des 512 de ménages et d'entreprises sans contrepartie : il faut lui donner les écritures d'ouverture (la monnaie créée au
   départ, les dépôts à la banque), directement dans son JSON (pas de migration).

## Étapes proposées

1. **Les leviers fédéraux** *(fait le 2026-11-08)* : le taux directeur et la réserve obligatoire sont un seul réglage pour toute la fédération, gardé une fois pour
   la partie (`FederalMonetaryPolicyRepository`, dans les réglages de la partie, plus sur le hameau). Question 1 tranchée selon la proposition : le joueur les règle
   dès qu'**au moins une** banque centrale d'État fonctionne, dans n'importe quel hameau ; sinon les valeurs du catalogue (`DEFAULT_FEDERAL_MONETARY_POLICY`)
   s'appliquent. Le **refinancement reste national** : seule la banque centrale de l'État refinance la banque de cet État ; un État sans banque centrale en activité
   ne refinance pas sa banque, même si les leviers bougent ailleurs.
2. **Le compte au Trésor** : le compte de l'État est tenu à sa banque centrale ; les flux de l'État avec les clients de la banque font bouger les réserves de la banque.
   - *2a, fait le 2026-11-08* : une seule liste des comptes de trésorerie (`CASH_ACCOUNTS` : 512, 515, 53), lue par tous (la trésorerie, le bilan, le grand livre,
     l'économie du hameau, les flux du livret) ; les écritures de l'État (M57) portent son argent au **515** au lieu du 512. Le journal du prefab porte encore ses
     anciennes lignes de l'État au 512 : elles restent de la trésorerie et se lisent juste ; elles passeront au 515 avec ses écritures d'ouverture (question 7).
   - *2b, fait le 2026-11-08* : la banque centrale de l'État est une **institution** : ses comptes sont tenus sous l'État (`centralBankAccountOf`), dès la fondation,
     que son bâtiment existe ou non (le bâtiment ouvre le guichet : le refinancement le demande en activité). Elle **ne tient pas d'argent** : les intérêts que la
     banque lui paie retirent de la monnaie (1678 au débit), le résultat qu'elle verse à son État crédite le compte du Trésor (1674). Une fois par mois, l'**écriture
     de centralisation** met le compte du Trésor qu'elle tient au niveau de l'argent de l'État, calculée depuis les soldes (une seconde passe n'écrit rien, une purge
     ne perd rien) : la dotation de fondation (ce qui est venu du 1021) est de la monnaie qu'elle a créée une fois (2768), le reste de ce que l'État a encaissé du
     public est de la monnaie revenue (1678 au débit), ce qu'il a payé de la monnaie émise (1678 au crédit). Les deux ne sont égaux qu'à la clôture du mois.
     Tant que l'argent des ménages et des entreprises vient de nulle part (étapes 3 et 4), la monnaie émise (1678) peut passer sous zéro : l'État encaisse de
     l'argent que la banque centrale n'a jamais émis.
3. **Les dépôts** : la banque porte à son passif les dépôts de ses clients ; ses prêts créent des dépôts au lieu de prendre sa caisse ; ses réserves sont son compte à la
   banque centrale, et la réserve obligatoire porte sur elles. *Fait le 2026-11-08.*
   - **L'identité** : réserves de la banque = sa propre trésorerie + l'argent de ses clients (la somme de leurs 512). Un paiement entre deux clients ne bouge ni les
     dépôts ni les réserves ; un crédit à un client crée le dépôt sans toucher aux réserves ; un paiement qui sort de la banque (l'État, l'étranger) prend des réserves.
     La position de la banque se lit à tout instant du pli (`BankRefinancing.#positionOf`).
   - **Question 5 revue** : au lieu d'une jambe « dépôts » sur chaque écriture, une **écriture de centralisation mensuelle** de la banque, comme pour le compte du
     Trésor en 2b (calculée depuis les soldes : une seconde passe n'écrit rien, une purge ne perd rien) : sa trésorerie est portée à ses réserves (5151), ses dépôts à
     vue (1651) mis au niveau de l'argent de ses clients, et les réserves que la banque centrale tient pour elle (1673) au niveau de ce qu'elle y tient. Chaque écriture
     reste équilibrée ; les dépôts écrits ne sont justes qu'à la clôture du mois, la position vivante l'est toujours.
   - **La contrainte de la banque, ce sont ses réserves** : un prêt à l'État prend des réserves ; un crédit à une entreprise n'en prend pas mais augmente la réserve due ;
     un retrait du livret est un transfert entre deux dépôts, jamais refusé faute de trésorerie. Chaque mois, une banque sous sa réserve due est refinancée.
   - **La liquidation de la banque** : elle encaisse ce qu'on lui doit, puis rend les dépôts à vue de ses clients en billets sur ses réserves (les réserves que la
     banque centrale tenait pour elle deviennent de la monnaie émise) ; le reste de ses réserves paie le reste de la liquidation (les livrets, la banque centrale,
     la ville) ; un découvert restant à la banque centrale est abandonné par la banque et perdu par la banque centrale.
   - Reste pour l'étape 4 : l'argent des clients d'un État sans banque (ou après sa liquidation) reste au 512 ; il devient des billets (53) avec la monnaie de départ.
4. **La monnaie de départ et l'État sans banque** : la création monétaire à la fondation, les billets avant la banque, le prefab. *Fait le 2026-11-08.*
   - **La monnaie de départ** était déjà posée en 2b : la dotation de fondation (ce qui vient du 1021) est de la monnaie créée une fois par la banque centrale (2768).
   - **Les billets, et l'argent venu d'ailleurs** (`BankRefinancing.centraliseExternal`, dernière centralisation du mois, depuis les soldes) : la monnaie que la banque
     centrale a émise et qui est entre les mains du public (1678) égale ce que ses clients détiennent **en billets** : tout leur argent quand l'État n'a pas de banque
     (il reste leur 512, comptablement, mais la banque centrale le doit en billets), rien quand il en a une (leur argent est alors des dépôts, adossés aux réserves de
     la banque). L'écart est de l'argent **venu de l'étranger** (un export vendu) ou **payé là-bas** (un import, un entretien payé hors du jeu) : la banque centrale l'a
     converti, contre ses **avoirs en devises** (2761, sous zéro quand l'État a plus payé qu'il n'a reçu de l'étranger). Les billets sont ainsi tenus sans écriture
     par achat : une écriture par mois.
   - **Ordre du mois** : le refinancement d'une banque sous sa réserve passe **avant** la centralisation de ses livres (sa position vivante compte déjà sa trésorerie
     non centralisée), sinon l'argent prêté se lirait comme venu de l'étranger.
   - **Le prefab** : le journal de la ville (1457 lignes, 1334 jambes) est passé du 512 au **515** directement dans son JSON (script lancé une fois à la main, qui refuse
     d'écrire si le fichier ne se relit pas à l'octet près ou si une écriture cesse d'être équilibrée) ; le journal des flux privés (ménages, entreprises) reste au 512
     (argent de clients). Aucune écriture d'ouverture n'est nécessaire : au premier mois, les centralisations déduisent tout des soldes. `tests/shared/prefab.test.js`
     garde que ce premier mois se règle sans erreur et que les comptes s'accordent.
   - **Ce que le prefab montre, tel qu'il est** : la ville est à découvert de 9 332 € (son compte au Trésor est négatif : la banque centrale lui a avancé cet argent, ce
     que la décision 3b interdit pour l'avenir, voir ci-dessous) ; la banque centrale a des avoirs en devises de −6 209 € (les imports ont dépassé les exports) ; la banque
     du prefab n'a eu aucun revenu et a 151 € de charges impayées (fonds propres négatifs : elle est insolvable dès le premier mois).
5. **Le corridor de taux et les garanties** *(fait le 2026-11-08)* :
   - **Le corridor** (`LoanRatePolicy.corridorOf`) autour du taux directeur : la **facilité de dépôt** (taux − 2 points, jamais sous 0) rémunère chaque mois les réserves
     de la banque au-delà de la réserve due (écriture OD : 5151 / 768 pour la banque, 6615 / 1673 pour la banque centrale) ; le **refinancement principal** (le taux
     directeur, 1649) entretient la réserve à la clôture du mois ; le **prêt marginal** (taux + 3 points, 1648) est l'emprunt urgent, pour prêter. Chaque facilité a
     son compte et ses clés d'idempotence ; les intérêts se paient d'abord sur le marginal, le remboursement va d'abord au marginal.
   - **Les garanties** (`collateralCapacityOf`) : la banque centrale ne prête que contre les prêts de la banque (274), décotés de `COLLATERAL_HAIRCUT` (10 %), le prêt
     qu'elle s'apprête à faire comptant lui aussi. Au-delà : refus avec la raison `collateral` (le panneau des prêts le dit) ; la clôture du mois, elle, prête ce que les
     garanties permettent (`partial`). Une banque qui a prêté sans fonds propres ne peut donc plus être refinancée : c'est ce qui ouvre l'étape suivante.
   - La liquidation rembourse le prêt marginal d'abord, abandonne le reste (perte de la banque centrale).
6. **Le ratio de fonds propres** *(fait le 2026-11-08)* : le superviseur lit les fonds propres de la banque (son bilan dérivé) contre ses prêts (274), `capitalStatusOf` :
   *sain*, *avertissement* sous `CAPITAL_WARNING_RATIO` (12 %, une dépêche par mois), *prêts gelés* sous `MIN_CAPITAL_RATIO` (8 % : `coverShortfall` refuse tout nouveau prêt
   à l'État et tout nouveau crédit aux entreprises avec la raison `capital`, l'entretien de la réserve continue), *insolvable* sous zéro. La ville peut recapitaliser dans les
   trois premiers états (jusqu'au ratio d'avertissement), liquider seulement quand elle est insolvable.
7. **La garantie des dépôts plafonnée et financée par les banques** *(fait le 2026-11-08)* : à la liquidation, la ville rend chaque épargnant entier jusqu'à
   `DEPOSIT_GUARANTEE_CAP` (500 €, ce que la banque a déjà rendu compte) ; au-delà, l'épargnant perd la différence (`od_deposit_lost`, 654 / 275). Chaque mois la banque
   verse à la ville une prime, `DEPOSIT_GUARANTEE_PREMIUM_RATE` (0,3 % par an) de son épargne (`deposit_guarantee_premium` : 616 pour la banque, 758 pour l'État). Le fonds
   n'est pas un compte à part : ce sont les recettes de l'État, la garantie une de ses dépenses. Plafond et taux sont des chiffres de départ à régler en jouant.
8. **Le don d'une ville partenaire** *(fait le 2026-11-08)* : la trésorerie de départ reste la dotation du fondateur (1021, monnaie créée par la banque centrale de l'État). Plus tard, quand la ville n'a plus d'argent, ne peut plus emprunter (pas de banque, prêts gelés, ni réserves ni garanties, ou dette publique brute au plafond de 60 % de son produit intérieur, `PublicDebtCatalog`, jamais sous 5 000 €) et commerce avec une ville du catalogue \`BenefactorGiftCatalog\` (tableau par ordre de priorité, l'indice 0 d'abord), cette ville lui offre une somme, une seule fois par partie, et seulement pendant les 5 premières années (\`firstYears\`) : une dépêche, le bouton « Accepter », le choix « Refuser » (sans conséquence pour l'instant). Accepté, c'est une écriture \`benefactor_gift\` (M57 1025, ligne « Dons de villes partenaires » du livret) : de l'argent venu d'ailleurs, converti par la banque centrale contre ses avoirs en devises (2761). Les dons par mission viendront : même écriture, une clé d'idempotence par mission.
9. **Les arriérés de l'État** *(fait le 2026-11-08)* : ce que l'État ne peut pas payer faute de Trésor et doit à un créancier nommé (traitements, allocations chômage, indemnités maladie, aides aux services : `StateArrearsCatalog`) est inscrit quand même, contre ce qu'il doit (401, écritures `od_state_arrears_*`), puis payé dès que le Trésor le permet (`SettleStateArrears`, avant les paiements du mois, les ménages d'abord, au prorata dans un même rang). Dû à un bâtiment disparu, c'est abandonné. La dette se lit du journal, survit à une purge, et compte dans la dette publique brute donc dans le plafond d'endettement. Limites : l'entretien et les aides sans créancier nommé (entreprises, propriétaires de logements) sont encore perdus ; le paiement tardif ne rétablit pas la retenue (impôt, cotisations) de la fiche de paie d'origine.
10. **Plus tard** : les flux entre États quand ils existeront ; une politique de prime selon le risque de la banque.