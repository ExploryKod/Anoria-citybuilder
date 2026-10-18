# Plan : dettes d'exploitation et faillite (étape 4 de PLAN_ACCOUNTING_ALIGNMENT)

Aujourd'hui tout est réglé au comptant : un salaire, un loyer, une cotisation ou un impôt qu'une entreprise ne peut pas payer n'existent pas comme dette, la ligne est simplement écrite et le compte passe en négatif. Sans dette qui s'accumule, « ne plus pouvoir payer » n'a pas de sens, donc la faillite non plus. Ce plan ajoute d'abord les dettes d'exploitation (4a), puis la faillite qui en découle (4b).

## Décisions prises

- **Garantie des salaires** : la ville les paie (un fonds de garantie des salaires, comme l'AGS en France).
- **Délai de grâce** : 3 mois de cessation de paiements avant la liquidation, déclaré au catalogue.
- **Ménages** : ils peuvent faire faillite et partent alors (système de départs existant).
- **SCI et hameau** : leur faillite est la fin de partie.
- **Liquidation automatique** : pas de décision du joueur ; un message prévient avant la fin du délai, et la subvention aux entreprises reste son levier pour aider une entreprise en difficulté.

## Principes

- **La faillite est une cessation de paiements, pas un bilan négatif** : l'entreprise ne peut pas régler, trois mois de suite, ce qu'elle doit et qui est exigible (salaires, cotisations, impôts, loyers). Un bilan négatif ne la liquide pas.
- **Deux étages** : *difficulté* (un message dans les problèmes du bâtiment, l'entreprise continue), puis *liquidation* après le délai. Pas de redressement détaillé.
- **La liquidation ferme l'entreprise, elle ne démolit pas le bâtiment.** Le bâtiment reste à la SCI, vacant et relouable ; les ouvriers sont licenciés ; l'entreprise s'arrête. (Démolir un bâtiment reste ce qui détruit l'activité hébergée, voir la sortie d'actif de `PLAN_ACCOUNTING_ALIGNMENT`.)
- **Les pertes remontent** : ce qui n'est pas payé est une perte chez le créancier (créance irrécouvrable, 654). Une faillite peut en entraîner une autre.
- **Les associés ne répondent pas des dettes** : les ménages d'une coopérative perdent leur part, pas plus (cohérent avec « aucune poursuite »).
- **Le journal reste la seule trace** : les dettes sont dérivées des lignes et des OD, jamais stockées ; la liquidation est une suite d'OD écrites une fois. Rien de dérivé n'est écrit dans une ligne de ménage ou d'entreprise.

## Qui peut faire faillite

| Entité | Faillite ? |
|---|---|
| Entreprise (ferme, usine, entrepôt, marché, service) | Oui |
| Coopérative d'une maison | Oui : seule l'entreprise de la maison est liquidée, la maison reste |
| Ménage | Oui : un ménage qui ne peut plus payer ce qu'il doit (le loyer, ses services) **part**. C'est le système de départs existant (cause « loyer impayé », dette effacée sans poursuite, délai avant repeuplement) ; un ménage n'est pas une entité du plan comptable, il n'a ni liquidation ni bilan |
| SCI de la maison-mairie | **Sa faillite est la fin de partie** : elle possède tout, elle ne peut pas être liquidée et relancée |
| Hameau | **Sa faillite est la fin de partie** |

La ville est la somme des hameaux : la faillite de l'un d'eux est la fin de partie de la ville.

## Fin de partie : faillite de la SCI ou du hameau

Ce sont les deux entités dont la défaillance ne se répare pas : la SCI possède tous les bâtiments et encaisse tous les loyers, le hameau paie les administrateurs, les allocations, les subventions et la garantie des salaires. Leur faillite arrête la partie.

- **Test** : le même délai que pour une entreprise (`INSOLVENCY_GRACE_MONTHS`, 3). La SCI ou le hameau est en cessation de paiements quand sa trésorerie est négative à la clôture du mois, une fois le règlement du mois passé, trois clôtures de suite. Ni l'une ni l'autre n'a de créancier à qui elle doit un impayé (ses charges n'ont pas de contrepartie dans le jeu) : leur « impayé » se lit donc dans la trésorerie.
- **Message avant la fin** : dès la première clôture en négatif, un message d'avertissement dit le nombre de mois qui restent (comme la difficulté d'une entreprise). Les leviers du joueur : le taux de subvention d'entretien des maisons, l'encadrement des loyers (un plafond sous le loyer d'équilibre fait perdre de l'argent à la SCI chaque mois : c'est maintenant une décision qui coûte), les impôts, les emprunts.
- **Fin de partie** : elle passe par le dispositif existant (`showGameOver` et `onGameOver` de `runGameTick`, derrière l'interrupteur `isLoseMode()` : en mode sans défaite, le message s'affiche mais la partie continue). L'écran dit la cause : « la SCI est en faillite » ou « le hameau est en faillite ». La famine a déjà son compteur de morts ; la faillite est une seconde cause, avec son propre état dérivé du journal.
- **À régler en jouant** : la SCI vit près de zéro (son loyer d'équilibre couvre l'entretien avec une marge nulle). Un test « trésorerie négative » trop strict la ferait tomber au moindre loyer impayé. Il faudra vérifier si une tolérance est nécessaire (un seuil déclaré, par exemple une fraction de l'entretien mensuel) ; elle serait déclarée au catalogue, jamais écrite en dur. Un début de partie ne doit pas non plus se terminer pendant que la SCI n'a pas encore encaissé son premier loyer : le test ne court pas avant la fin de la première année, ou avant le premier loyer encaissé.
- **Sauvegarde** : l'état « en faillite » n'est pas stocké ; il est relu dans le journal, comme tout le reste.

## Déficit public, emprunts et notation (à régler avant la faillite de la ville)

Une ville, comme les autres entités, peut avoir un **déficit public** (ses dépenses dépassent ses recettes). Dans le réel, un déficit n'est pas une faillite : il se finance par la trésorerie, puis par l'emprunt, et le taux de l'emprunt dépend de la **note** de l'emprunteur (AAA, AA, A, B, C). La faillite est de ne plus pouvoir financer ses paiements. La fin de partie de la ville doit donc se tester sur cette impossibilité de financer, pas seulement sur une trésorerie négative.

**Ce qui existe déjà** : des prêts (`loan_capital`, intérêts et remboursements `loan_interest` et `loan_repayment`, des lignes informatives `info_loan_*` quand une échéance n'est pas payée) ; `LoanRatePolicy` (taux de base de 5 % banque et 7 % commercial, majoré selon un état de santé financière) ; `assessFinancialHealth`, qui écrit déjà « Faillite ! » quand la trésorerie passe sous zéro, sans conséquence de jeu.

**Conception proposée**
1. **Déficit** : il se lit sur l'année (recettes moins dépenses courantes de la ville, hors investissements) et n'est pas écrit. Les leviers du joueur : impôts, subventions, encadrement des loyers, dépenses, emprunt.
2. **Note de la ville**, de AAA à C, **dérivée du journal**, jamais stockée, recalculée à chaque clôture mensuelle. Indicateurs, tous lus dans le journal :
   - le solde de l'année sur les recettes (déficit ou excédent) ;
   - la dette sur les recettes de l'année ;
   - la charge d'intérêts sur les recettes ;
   - la trésorerie en mois de dépenses ;
   - l'historique de défauts (échéances non payées).
   Un barème déclaré au catalogue (`CreditRatingCatalog`) transforme ces indicateurs en note : les seuils de chaque note y sont, jamais écrits en code.
3. **Prix du crédit** : le taux d'un nouvel emprunt est le taux de base plus l'écart (spread) de la note, déclaré au catalogue. Il remplace les pénalités de `LoanRatePolicy`. Le taux est fixé à l'émission, comme dans le réel : une dégradation ne change que les nouveaux emprunts.
4. **Accès au crédit** : chaque note a un plafond d'endettement (une part des recettes annuelles). Sous la note B, un plafond bas ; en C, plus d'accès au crédit.
5. **Défaut et faillite** : une échéance d'emprunt que la ville ne peut pas payer est un défaut (les lignes `info_loan_*` existent déjà) ; la note tombe à C. La fin de partie arrive quand la ville ne peut plus financer ses paiements, c'est-à-dire sa trésorerie est négative **et** son plafond d'emprunt est atteint ou son accès au crédit fermé, trois clôtures de suite. Tant qu'elle peut emprunter, un déficit est financé par la dette.
6. **Avertissements** : un message à chaque changement de note, et au premier défaut, avec le nombre de mois avant la fin de partie.
7. **Hameaux et ville** : la ville est la somme des hameaux ; la note est celle de la ville consolidée. Reste à décider si chaque hameau emprunte et a sa note (voir les décisions).
8. **Les entreprises** : les prêts « commerciaux » des banques pourraient suivre le même principe avec une note d'entreprise. Hors de ce travail : à décider quand la liquidation des entreprises est faite.

**Points à décider avant de coder**
- La ville est-elle notée en un bloc, ou chaque hameau a-t-il sa note et ses emprunts ?
- La note se compose-t-elle des cinq indicateurs ci-dessus, ou d'un sous-ensemble plus simple pour commencer (par exemple dette sur recettes et trésorerie) ?
- Qui prête à la ville : la banque du jeu (le bâtiment), une institution abstraite (l'« État »), ou les deux ? Aujourd'hui les prêts passent par la banque ; une ville sans banque n'a aucun accès au crédit.
- Combien de clôtures sans pouvoir financer avant la fin de partie : 3, comme pour les autres ?

**Lien avec les autres étapes** : la comptabilité publique du hameau (étape 5 de `PLAN_ACCOUNTING_ALIGNMENT.md`) donne le déficit, la dette et les immobilisations publiques qu'il faut pour noter ; elle doit venir avant ou avec la faillite de la ville.

## Étape 4a — Dettes d'exploitation impayées (FAIT)

**Réalisé** : `PayableCatalog` (rangs, OD de dette, lignes de règlement, `FOUNDING_CAPITAL_MONTHS`, `INSOLVENCY_GRACE_MONTHS`) ; `DebtPolicy` (`payByRank`, `availableToPay`, `planCompanyPayments`, `payablesOf`, `difficultyMonthsOf`) ; dans `SettleProducerCharges`, une entreprise paie ses vieilles dettes d'abord, puis les charges du mois par rang (salaires de chaque maison, cotisations patronales, loyer du local), puis l'impôt sur les sociétés avec ce qui reste ; ce qui n'est pas payé devient une OD `od_payable_*` ; la coopérative d'une maison fait de même pour le loyer de son local (`SettleHouseRents`), la SCI écrit son loyer à encaisser (`od_receivable_premises_rent`, 411) ; le bilan affiche les dettes (421, 431, 444, 401), les créances (411) et la dette bancaire d'un compte sous zéro (519) ; la balance et le grand livre les reprennent ; le bâtiment dit « impayés N mois » dans ses problèmes (`accounting.getInsolvency`). Tests : `payables.regression.test.js`, `balanceSheet.test.js`.

**Prérequis découvert en codant : le fonds de départ.** Aujourd'hui les entreprises tournent sur un compte négatif : sans argent au premier mois, une entreprise qui ne peut rien payer ne verse aucun salaire, donc aucune maison n'a de quoi acheter, donc aucune entreprise ne vend : l'économie ne démarre jamais. Il faut donc un fonds de départ. Décision : **un capital (fonds propres) versé par la ville**, pas une avance remboursée (le plan `PLAN_IMPORTS_PRICES_CAPITAL.md` prévoyait une avance ; ce capital la remplace).
- **Quoi** : à la création d'une entreprise (ou de l'entreprise d'une maison, la coopérative), la ville lui verse `FOUNDING_CAPITAL_MONTHS` (2) mois de ses charges à pleine dotation (salaires de `workerNeed` ouvriers au salaire du marché, cotisations patronales, entretien ou loyer). C'est le capital de l'entreprise (101) contre les titres de participation de la ville (261) ; il n'est jamais remboursé. Pour la ville, c'est un investissement (comme une construction : `totalInvestments`, et la ligne « Constructions » du livret), pas une charge courante.
- **Quand** : `FundNewCompanies`, avant le règlement du premier mois de l'entreprise (`ProcessTurnBudget`). Savoir si une entreprise est financée se lit dans le journal, y compris après une purge (le solde du compte 101 de la clôture).
- **Prefab de départ** : la ville de départ a déjà ses entreprises ; son journal porte leurs lignes de capital (25 entreprises, 1046,80 €) et un capital de départ de 1546,80 € pour que le compte propre de la ville reste à 500 € (`prefab.test.js`).
- **Échelle** : une nouvelle entreprise coûte maintenant à la ville environ 40 à 90 € de capital en plus de son prix de construction (10 € environ) : avec 500 € de départ, on en fonde peu. À régler en jouant (`FOUNDING_CAPITAL_MONTHS`).
- **Risque** : rien n'empêche la ville de verser un capital qu'elle n'a pas : sa trésorerie peut passer sous zéro. Avec la fin de partie de 4b (hameau en faillite), il faudra décider si la fondation est bloquée faute de fonds.
Le compte d'une entreprise sous zéro (à cause des achats ou de l'entretien sans propriétaire, qui n'ont pas de créancier) reste possible : le bilan l'affiche en dette bancaire (519).

**Limites connues**
- Les salaires d'un mois pris en dette ne sont pas pris en compte pour le calcul des factures de services des ménages du même mois (le plan du mois suppose les salaires versés) : un ménage peut payer un service avec un salaire qu'il reçoit plus tard.
- Un salaire arriéré versé plus tard ne subit ni cotisation salariale ni impôt sur le revenu (ils ne sont retenus que sur les salaires du mois).
- La créance de la ville (cotisations, impôt) n'est pas écrite côté ville (l'étape 5 traite la comptabilité publique) ; seule la SCI écrit sa créance.
- Un loyer de local dû à un propriétaire qui n'existe plus (maison-mairie démolie) reste une dette non payable.
- Les achats de marchandises et l'entretien sans propriétaire ne sont pas des dettes : ils n'ont pas de créancier dans le jeu, la caisse peut descendre sous zéro à cause d'eux ; c'est le découvert.
- Les ménages, la SCI et le hameau n'ont pas de dette ici ; la liquidation et la fin de partie sont l'étape 4b.

**Objet (rappel)** : un montant exigible qu'une entreprise ne peut pas régler faute d'argent devient une dette au passif, qui se règle dès que la caisse le permet.

- Dettes concernées : salaires des ouvriers (421), cotisations sociales (431), TVA et impôts (4457, 444), loyers de local (dette envers la SCI). Pas de crédit entre entreprises (ni client ni fournisseur) dans cette étape.
- **Mécanique** : à la clôture du mois, chaque charge exigible d'une entreprise est réglée dans la limite de sa caisse, par rang : salaires d'abord, puis cotisations et impôts (ville), puis loyers, comme le rang de la liquidation. Ce qui n'est pas réglé est une dette. Aujourd'hui les lignes sont écrites même si la caisse est vide (le compte passe en négatif) ; ce comportement est à vérifier au moment de coder, ligne par ligne.
- **Écritures** : une charge exigible non payée est une OD de charge à payer (charge au résultat contre le compte de dette, par exemple 6411 contre 421) ; son règlement ultérieur est une ligne d'argent qui solde la dette (débit du compte de dette, crédit de la banque). Le résultat enregistre donc la charge au mois où elle est due, pas au mois où elle est payée (comptabilité d'engagement pour ces charges). Types d'OD déclarés dans `PcgJournalCatalog`.
- **Dérivation** : la dette d'un compte envers chaque créancier se lit dans le journal, comme `rentDebtsOf` pour les loyers des ménages. Le bilan l'affiche au passif (lignes 421, 431, 444, 4457, dettes envers la SCI) ; la balance et le grand livre la montrent.
- **Créancier** : côté ville (cotisations, impôts) et côté SCI (loyers), l'impayé est une créance : l'actif du bilan de la SCI la montre (411 pour les loyers de local). Un salaire impayé est une créance du ménage ; elle n'est pas un actif de ménage dans le bilan (un ménage n'a pas de bilan), mais elle reste visible dans son budget.
- **Message** : une entreprise qui a une dette exigible depuis un mois entre en difficulté ; le bâtiment affiche un problème (icône et mot, détail en infobulle, comme les autres problèmes) avec le nombre de mois restant avant la liquidation.
- **Perf** : tout est calculé à la clôture du mois, une seule fois par entreprise ; aucune écriture à chaque tour.

## Étape 4b — Faillite et liquidation

**Déclencheur** : à la clôture, une entreprise dont les dettes exigibles ne sont pas intégralement payées trois mois de suite (`INSOLVENCY_GRACE_MONTHS`, 3, déclaré au catalogue) est liquidée.

**Séquence** (une fois, idempotente par entreprise) :
1. **L'activité s'arrête** : ouvriers licenciés, aucune production ni vente ; le bâtiment reste, vacant.
2. **Le stock est vendu à un taux de liquidation** (`LIQUIDATION_RECOVERY_RATE`, déclaré au catalogue, à régler en jouant) ; le produit va à la caisse de l'entreprise.
3. **Paiement des créanciers par rang** avec la caisse et ce produit : salaires, puis ville (cotisations, impôts), puis SCI (loyers), les créanciers d'un même rang payés proportionnellement.
4. **Le fonds de garantie de la ville** paie les salaires que la liquidation ne couvre pas : une charge de la ville, une recette pour les ménages concernés.
5. **Le reste est une perte** : une OD de perte sur créance irrécouvrable chez chaque créancier (654 pour la SCI, charge de la ville pour la ville).
6. **Les associés** : une coopérative perd ses parts ; les dividendes et la participation de l'exercice ne sont pas versés. Aucune poursuite des ménages.
7. **Clôture de liquidation** : une OD solde tous les comptes de l'entreprise ; son grand livre, sa balance et son bilan restent lisibles en archive.

**Après** : le bâtiment vacant peut être reloué à un nouvel exploitant (nouvelle entreprise, nouveau compte) ; l'ancien compte reste fermé. Une coopérative liquidée laisse sa maison, qui peut ouvrir une nouvelle entreprise.

### Étape 4b — Liquidation d'une entreprise (FAIT)

Ce qui est codé (faillite de la SCI et du hameau, notation et crédit : pas encore) :
- **État « liquidée »** : une ligne informative `info_company_liquidated`, écrite une fois ; il se lit dans le journal (`liquidatedIdsOf`). La ligne du bâtiment reçoit `liquidatedAt` (le tour) pour que l'emploi et l'approvisionnement la lisent sans interroger la comptabilité.
- **Déclencheur** : `LiquidateCompanies.begin`, avant le règlement du mois, liquide une entreprise dont `difficultyMonthsOf` atteint `INSOLVENCY_GRACE_MONTHS`.
- **Vente du stock** : `liquidation_stock_sale` (775), à `LIQUIDATION_RECOVERY_RATE` du coût ; l'argent paie les créanciers par rang dans le règlement du mois (`SettleProducerCharges`, qui ne facture plus rien à une entreprise fermée : ni salaires, ni entretien, ni loyer, ni impôt).
- **Le reste est abandonné** : `LiquidateCompanies.end` écrit, par dette ouverte, une OD d'abandon de créance chez l'entreprise (`od_forgiven_*`, 771) ; chez le créancier une perte sur créance (`od_bad_debt_*`, 654) pour les cotisations, l'impôt et le loyer ; les salaires sont garantis par la ville (`wage_guarantee_paid`, flux avec le `household_wage` du ménage, net, sans retenue).
- **Arrêt de l'activité** (après le lot du mois, `runGameTurnEconomy`) : les ouvriers sont renvoyés (`closeWorkplace`), le stock physique est vidé (`clearStock`), le bâtiment ne peut plus ouvrir (poste requis ≥ 1, aucun ouvrier). La clôture du mois suivant constate la baisse du stock (OD de variation).
- **Message** : problème « 🔒 liquidée » dans l'onglet messages du bâtiment.
- Test de non-régression : `tests/contexts/accounting/liquidation.regression.test.js`.

Limites connues : le bâtiment reste vacant (pas de reprise par un nouvel exploitant : le joueur le démolit et le reconstruit) ; l'argent qui reste dans la caisse d'une entreprise liquidée après paiement de tout y reste ; une coopérative (maison) n'est pas liquidée ; la purge d'une année ne reporte pas encore les dettes ouvertes d'une entreprise liquidée (toutes soldées par l'abandon, donc sans effet tant que la liquidation les solde le même mois).

## Où cela s'insère dans le code

- `PcgJournalCatalog` : les OD de charge à payer, de règlement de dette, de liquidation et de perte sur créance.
- `DebtPolicy` (domaine comptable) : dettes par compte et par créancier, dérivées du journal, rang de paiement.
- `SettleProducerCharges` : une charge exigible est réglée dans la limite de la caisse et par rang ; le reste devient une dette.
- `CloseMonthAccounts` : après le règlement, il règle les dettes que la caisse permet, constate les mois de cessation de paiements, puis liquide.
- `InsolvencyPolicy` et un catalogue `InsolvencyCatalog` (délai, taux de liquidation, rang) : le test de cessation de paiements est pur et lisible en test.
- `BalanceSheetPolicy` : le passif affiche les dettes ; l'actif de la SCI affiche ses créances.
- Un problème de bâtiment « en difficulté » dans le panneau des messages, avec le vocabulaire du catalogue.
- `InsolvencyPolicy` donne aussi le test de la SCI et du hameau (trésorerie négative à la clôture) ; la clôture l'appelle et, pour une fin de partie, passe par `runGameTick` (`showGameOver`, `onGameOver`) derrière `isLoseMode()`.
- Un état « liquidée » par entreprise (dérivé de l'OD de clôture de liquidation) ; l'emploi, l'approvisionnement et la production lisent cet état pour arrêter l'entreprise. Pas de nouvelle donnée stockée : l'état se lit dans le journal.

## Tests (peu, de non-régression)

- Une charge qu'une caisse vide ne peut pas payer devient une dette, qui se solde quand l'argent arrive, par rang.
- Trois mois de dettes exigibles impayées déclenchent la liquidation ; deux mois non.
- La liquidation paie par rang, le fonds de la ville couvre les salaires restants, le reste est une perte chez le créancier, et le bilan de l'entreprise comme celui du créancier équilibrent.
- Un ménage qui ne peut plus payer part (test existant des départs, non cassé) ; il n'est ni liquidé ni sorti du bilan.
- La SCI ou le hameau en négatif trois clôtures de suite déclenche la fin de partie ; deux clôtures seulement, un avertissement ; avec `isLoseMode()` faux, aucune fin de partie.

## Limites et points ouverts

- **Pas de crédit commercial** : la faillite par un fournisseur ou un client qui ne paie pas viendra avec l'étape 4 complète ; ici seuls les salaires, cotisations, impôts et loyers sont des dettes.
- **Pas de redressement** : une entreprise en difficulté ne peut être sauvée que par la subvention du joueur ou par un retour à l'équilibre avant la fin du délai.
- **Équilibre du jeu** : le délai de 3 mois et le taux de liquidation sont des premières valeurs ; il faut jouer pour savoir si les faillites sont trop fréquentes (un début de partie peu rentable) ou trop rares.
- **Une purge** replie les OD de dettes et de liquidation dans la clôture de l'année : elle doit conserver les dettes encore ouvertes (à-nouveaux), comme elle conserve les soldes de bilan.
- **Calendrier** : tout reste en mois et en tours via `getDaysPerMonth()` et `MONTHS_PER_YEAR`, rien n'est écrit en dur.

## Ordre de travail

1. Catalogue : OD et paramètres d'insolvabilité.
2. `DebtPolicy` et règlement par rang dans `SettleProducerCharges` (4a), avec le bilan et le message de difficulté.
3. `InsolvencyPolicy`, puis la liquidation dans `CloseMonthAccounts` (4b), le fonds de garantie de la ville, les pertes chez les créanciers.
4. Arrêt de l'entreprise liquidée (emploi, production, vente) et reprise du bâtiment vacant.
5. Purge : conservation des dettes ouvertes.
