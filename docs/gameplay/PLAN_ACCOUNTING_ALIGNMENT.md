# Plan : aligner la comptabilité du jeu sur la vraie comptabilité

Le jeu peut servir à apprendre la comptabilité : il doit donc en suivre la structure (journal, grand livre, balance, bilan, compte de résultat), pas seulement en reprendre les comptes.

## 1. Où nous en sommes (fin de la phase 1)

**Fait**
- Journal en PCG : chaque type de ligne a son compte (`PcgJournalCatalog`).
- Compte de résultat par entreprise (`incomeStatementOf`) et ratios.
- Bilan dérivé d'une entreprise (`BalanceSheetPolicy`) : trésorerie, stock valorisé au coût, immobilisations, capital, emprunts, résultat cumulé. Il lit le journal, ne stocke rien, et lève une erreur s'il n'équilibre pas.
- Propriété : la SCI de la maison-mairie possède tous les bâtiments.
  - L'exploitant d'un bâtiment (entreprise, service) paie à la SCI un loyer égal à l'entretien (+ marge de la SCI, 0 aujourd'hui) : `premises_rent_paid` (6132) chez lui, `premises_rent_received` (752) et `maintenance` chez la SCI.
  - Une coopérative de maison loue le local de son activité : `premisesShare` (0,3, première valeur) de l'entretien de la maison, déclaré au catalogue. Le loyer des ménages prend le reste. Ce loyer n'est pas plafonné par l'encadrement des loyers.
  - Un bâtiment sans exploitant est loué par le hameau, sur la ligne « Entretien » de son livret.
  - La construction est payée par la ville ; le bilan de la SCI en déduit l'immobilisation (213, coût de construction net des remboursements) et l'apport en nature de la ville (101).
  - Sans propriétaire (maison-mairie démolie), les exploitants reprennent leur entretien.
  - Un loyer de local que la coopérative ne peut pas payer est une ligne informative (`info_premises_rent_due`), pas une dette reportée.

**Ce qui sépare encore le jeu du réel**
- Le journal est une liste de mouvements d'argent à une seule jambe. Une écriture réelle a un débit et un crédit de même montant.
- Pas de grand livre (les écritures par compte), pas de balance (la somme par compte, dont le total débit égale le total crédit).
- Pas d'écritures sans argent : amortissement, variation de stock, charges à payer.
- Tout est payé au comptant : pas de créances (411) ni de dettes (401).
- Le bilan est celui d'aujourd'hui : les quantités en stock ne sont pas historisées, un bilan passé est impossible.

## 2. Trois façons d'y arriver

1. **Double entrée partout.** Chaque ligne devient une écriture avec ses deux comptes. C'est le plus fidèle, mais il faut réécrire une quarantaine de types de lignes et toute l'idempotence.
2. **Postings dérivés.** Le catalogue PCG donne, pour chaque type de ligne, le compte débité et le compte crédité. Une fonction pure produit les postings de chaque ligne ; le grand livre et la balance se calculent à partir d'eux, sans écrire de nouvelle donnée.
3. **Hybride** (cible) : l'option 2, plus des écritures d'opérations diverses (OD) pour ce qui n'a pas d'argent, écrites une fois par mois et par entreprise.

## 3. Étapes

### Étape 0 — De vraies écritures en partie double (DÉCIDÉE, À FAIRE, avant les étapes 4b et 5)

**Décision** : le jeu suit le PCG comme un vrai système en partie double (option 1), au lieu des postings dérivés d'une ligne à une jambe (option 2, étapes 1 à 4a). Les règles correspondantes de `CLAUDE.md` sont réécrites : « Money: one flow », « Purge closes a year », « The journal holds écritures only », « The balance sheet is derived », « One balance ». Les étapes 1 à 4a restent vraies comme lectures (grand livre, balance, bilan, dettes) ; leur source change.

**Pourquoi** : une ligne à une jambe force `postingsOf` à deviner l'autre compte (la banque implicite, le `counter`), et elle donne à un type un seul point de vue (celui du payeur). Un impôt, une cotisation, un loyer sont deux écritures vues de deux acteurs : avec des écritures à deux jambes nommées, la ville, la SCI, l'entreprise et le ménage lisent chacun leurs comptes sans règle d'exception, et la consolidation n'est plus un cas à part.

**La forme d'une écriture** : un code journal (`BQ`, `VT`, `AC`, `PA`, `OD`, `AN`), un tour (année et mois posés à l'écriture), un compte propriétaire (l'acteur) et au moins deux jambes `{ compte, débit, crédit }` en centimes, équilibrées. L'écriture déséquilibrée est refusée à l'écriture, avec son type. La trésorerie est le solde des comptes de caisse (512, 53) : plus de `moneyDirectionOf`. `PcgJournalCatalog` déclare, par type d'écriture, ses jambes (comptes et sens) et son code journal ; c'est l'écrivain qui nomme les comptes, rien n'est deviné après coup.

**Clôture et purge** : la clôture de l'exercice est faite d'écritures ordinaires (classes 6 et 7 soldées contre 12, affectation du résultat en 110/119 et dividendes), la réouverture d'à-nouveaux (journal `AN`, une écriture équilibrée par compte de bilan). `year_closing` disparaît comme ligne de totaux : il ne reste qu'un `summary` en lecture seule (totaux par type, coût de chaque bâtiment). La purge remplace les écritures des années abandonnées par ces écritures de clôture et d'à-nouveaux ; elle ne change ni la trésorerie ni le bilan.

**Lecture et performance** : un seul pli (« fold ») du journal en mémoire, jamais stocké : `Map<acteur, année/mois → compte → { débit, crédit }>` en centimes, mis à jour en ne repliant que les nouvelles écritures (le journal ne fait qu'ajouter), reconstruit au chargement et après une purge. La trésorerie, la balance, le compte de résultat, le bilan et le livret de la ville en sont des sommes ; un bâtiment est une recherche, un hameau un filtre, la ville la somme des hameaux. Le détail du grand livre vient d'un index `acteur → écritures`. Le pli ne tourne jamais dans le chemin chaud d'un tour.

**Travail** (une réécriture d'un bloc, sans chemin de compatibilité, selon « No saved games to migrate »)
1. `JournalEntry` et son écriture : jambes nommées, refus du déséquilibre, codes journal ; `PcgJournalCatalog` réécrit en jambes par type.
2. Les services `Record*`, `Settle*`, `CloseMonthAccounts`, `FundNewCompanies` écrivent des écritures à deux jambes ; les OD deviennent le code `OD`.
3. Le pli et son cache ; `GetTreasurySnapshot`, `AccountLedgerPolicy`, `BalanceSheetPolicy`, `DebtPolicy` le lisent.
4. Clôture et à-nouveaux à la place de `year_closing` ; la purge.
5. Le prefab `anoria-tour-116` : son journal est réécrit en écritures à deux jambes (JSON direct).
6. Tests de non-régression : une écriture déséquilibrée est refusée ; la purge laisse la trésorerie et le bilan identiques ; la trésorerie de la ville est la somme de celles des hameaux ; le bilan équilibre.

**Avancement de l'étape 0**
- **Tranche 1 (FAITE)** : `PcgJournalCatalog` déclare, pour chaque type, ses deux jambes banque comprise (`legs`, `inflow`/`outflow`) dans chaque plan qui le tient (`plans.pcg`, `plans.m57`) et son code journal ; `legsOfType`, `planOfAccount`, `journalCodeOf`. `EntryLegsPolicy` (`entryLegsOf`, `assertBalanced`) construit les jambes en centimes et refuse une écriture déséquilibrée ou un type que le plan du compte ne tient pas (un compte d'entreprise écrivant un type réservé à la ville lève une erreur). `RecordLedgerEntry` les calcule à l'écriture et les range sur la ligne avec `journal` et `transactionId` (le champ `counter` a disparu : dépôts et retraits disent leur compte, 275 ou 165). Test : `entryLegs.regression.test.js`.
- **Tranche 2 (FAITE en partie)** : le journal (`SessionJournalStore`) comptabilise chaque écriture à l'écriture (`entryLegsOf` : jambes, code journal, refus du déséquilibre), quel que soit le chemin d'écriture ; `LegsFold` plie les jambes en mémoire par hameau, compte, année et mois (centimes), tenu à jour par le tampon (`SessionLedgerBuffer.legsFold()`, pli incrémental paresseux, reconstruit après une purge) ; la trésorerie est le solde de 512 dans ce pli (`GetTreasurySnapshot.cashOf`, `GetTreasuryBalance` sans lire une ligne) et `deriveTreasuryFigures` ne calcule plus de solde ; `postingsOf`, le grand livre et la balance lisent les jambes écrites. La recherche d'une clé métier (`hasBusinessKey`) ne parcourt plus le journal (un `Set`). Un bug de la tranche 1 corrigé : une OD sans charge ni produit (apport en nature, sortie d'actif) n'avait pas de code journal et aurait été refusée à l'écriture. Tests : `legsFold.regression.test.js`, `entryLegs.regression.test.js`, aide `tests/helpers/booked.js`.
- **Fin de la tranche 2 (FAITE)** : le compte de résultat (`incomeStatementOf`, charges et produits lus sur les jambes, une OD qui diminue une charge se lit toute seule), ce qui a bougé la caisse (`cashMovementsOf`, la jambe sur 512), le bilan (`balanceSheetOf`, chaque jambe sur son côté, la caisse lue à part) et la clôture d'année (`buildYearClosingLine`) lisent les jambes écrites ; `moneyDirectionOf` ne porte plus de liste de types : il lit le signe de la jambe sur 512 et ne sert qu'aux catégories de la trésorerie (revenus, dépenses, totaux, prêts, qui disent à quoi l'argent a servi) ; le total d'une année purgée est lu comme une écriture du type, comptabilisée comme le journal la comptabilise (vue seulement). `statementAmountOfOd` supprimée (code mort). Restent à la lecture : le compte de ventes d'un bâtiment (707 vers 701 ou 706), choisi d'après le type du bâtiment ; `MonthClosingPolicy` lit les jambes des OD dans le catalogue ;
- **Tranche 3 (FAITE)** :
  - *À-nouveaux* : la clôture d'une année purgée est une vraie écriture (journal `AN`, ses jambes : les soldes de bilan contre le résultat reporté 12) ; le pli, le grand livre et le bilan la lisent comme toute écriture, sans cas particulier « clôture » ; `closing` ne garde que le digest (totaux par type, flux de caisse par compte, coût des bâtiments, résultat), `closing.balances` a disparu.
  - *Le livret de la ville lit le pli* : `LegsFold.cashFlowsOf` (ce qui a bougé la caisse, par compte de contrepartie, tenu à jour comme le reste) ; `CityLedgerLineMappingPolicy` fait de chaque ligne du livret la somme de comptes M57 ; un compte sur lequel la caisse de la ville a bougé et qu'aucune ligne ne prend lève une erreur ; `GetCityLedgerYearComparison` lit le pli et la caisse de `cashOf`, plus le journal par type. Pour que les lignes restent distinctes, des comptes M57 ont été choisis un par ligne : maintenance 6156, réparations 615221, aide au logement 65741, aide aux entreprises 65742, aide aux services 65738, droits de douane à l'entrée 73431, à l'export 7348. Les remboursements (impôt, construction) se retranchent de leur ligne.
  - *Écritures reliées* : les lignes d'un flux entre comptes portent le même `transactionId` (le mois et le flux) : paie, cotisations, loyers, impôts, subventions, services et TVA (trois comptes), allocation, traitement, retenue, partage d'une coopérative, règlement d'une dette, dette et créance de loyer. `PcgJournalCatalog.hasCounterpart(type)` dit les types qui ont une contrepartie ; `SettleProducerCharges` refuse une ligne de flux qui ne nomme pas le sien (`flow`, ou `null` quand l'autre côté est écrit ailleurs) ; `TransactionLinkPolicy.unpairedFlowsOf` liste les flux vus d'un seul compte.
- **Tranche 4 (FAITE)** :
  - *Écriture du mois en un bloc* : `SessionJournalStore.batch(work)` garde les lignes en mémoire (le journal et le pli sont à jour tout de suite, `work` lit ce qu'il vient d'écrire) et les écrit en une seule transaction IndexedDB à la fin ; tout ou rien (si `work` ou l'écriture échoue, aucune ligne n'est gardée, la clé métier permet de rejouer le mois). `ProcessTurnBudget` y passe tout le règlement du mois (`inJournalBatch`). `markPersisted` ne parcourt plus le journal une fois par ligne.
  - *Retenue à la source* : chaque payeur retient, avant de payer, la part de cotisation salariale et d'impôt sur le revenu de chaque paie (`WithholdingPolicy.planWithholding`) : l'impôt est celui du foyer, progressif sur tout ce qu'il reçoit dans le mois (salaires de tous les employeurs, allocation, traitement), réparti en parts exactes au centime ; un salaire partiellement payé retient en proportion. Le ménage reçoit un **bulletin de paie**, une écriture du journal `PA` à plusieurs jambes (`payslipLegs` : le brut crédité à 421 ou 437, contre le net sur 512, la cotisation 431 et l'impôt 4421) ; la ville reçoit la cotisation et l'impôt **de l'employeur** (`social_contribution`, `payroll_tax`, contrepartie l'entreprise), ou les retient sur sa propre paie ; les quatre écritures d'un salaire (entreprise, ménage, ville ×2) sont un seul flux. Le ménage ne paie plus rien lui-même chaque mois (`employee_contribution` et l'`income_tax` mensuel disparaissent ; `income_tax` ne reste que pour la régularisation de fin d'année, qui lit l'impôt retenu dans les jambes des bulletins). Les lecteurs du budget des ménages (`buildingFinanceFigures`, `householdBudgetOf`) lisent les jambes 431 et 4421 des bulletins. Tests : `withholding.regression.test.js`, `socialContributions.regression.test.js`.
  - *Ce qui n'a pas changé* : l'entreprise écrit toujours son salaire d'un bloc (D 6411 / C 512, payé comptant) ; un salaire arriéré réglé plus tard ne subit toujours ni cotisation ni impôt (les dettes d'exploitation de l'étape 4a restent des OD) ; la régularisation annuelle reste au niveau du ménage.
- **Tranche 5 (FAITE)** :
  - *Créance de la ville* : une cotisation patronale ou un impôt sur les sociétés que l'entreprise ne peut pas payer devient, côté ville, une OD de créance au même mois (`od_receivable_corporate_tax` : D 411 / C 73118, le produit de l'année où l'impôt est dû ; `od_receivable_contribution` : D 4387 / C 431, sans produit : la ville doit ces cotisations à l'organisme social), reliée à la dette de l'entreprise par le même `transactionId`. Quand l'entreprise paie, la ville encaisse contre la créance (`corporate_tax_debt_received`, `contribution_debt_received`), jamais un produit une seconde fois. Le livret lit 411 et 4387 dans l'impôt sur les sociétés et les cotisations.
  - *Comptes de la ville en M57* : `M57StatementCatalog` (le compte de résultat par famille de comptes, les groupes du bilan), `CityStatementsPolicy` (le compte de résultat d'une année et le bilan, dérivés des totaux du pli ; les deux côtés du bilan doivent s'équilibrer, sinon erreur ; un compte sous zéro est un concours bancaire, un compte de tiers débiteur une créance), `GetCityStatements` et un panneau « Comptes de la ville (M57) » sous le livret de l'onglet Finances de l'administrateur. L'élimination des flux internes de la ville est déjà faite par construction : la ville est la somme des hameaux du pli (aucun flux n'existe entre deux hameaux).
  - *Construction* : ce que la ville construit est inscrit à 261 (titres de participation dans la SCI propriétaire) tant que le propriétaire existe, à 2131 (bâtiments publics) sinon, à 2151 (voirie) pour ce qui n'est pas un bâtiment (`ConstructionAccountPolicy`) ; le remboursement revient sur le même compte. Le bâtiment entre au bilan de la SCI contre son capital (OD d'apport) : le bâtiment n'est pas compté deux fois à la consolidation.
  - *`transactionId` partout* : prêts (capital, intérêts, remboursement avec le prêteur), dépôts et retraits, intérêts d'épargne.
- **Reste à faire** (non fait, avec la raison) :
  - la **liquidation et la fin de partie** (étape 4b) : arrêter l'activité, vendre le stock, payer les créanciers par rang, fonds de garantie des salaires, perte sur créance (654) : elle touche l'emploi, la production et l'approvisionnement (un état « liquidée »), et demande des choix de jeu (que devient le bâtiment, ses ouvriers, son stock) ;
  - la **paie en comptabilité d'engagement chez l'entreprise** (une écriture `PA` qui constate à l'échéance 6411, 645 contre 421, 431, 4421) : elle ferait des retenues non payées de vraies dettes ; non faite, car elle réécrit les dettes de l'étape 4a (`DebtPolicy`, `PayableCatalog`) pour un cas rare (un salaire arriéré réglé plus tard n'est toujours pas retenu) ;
  - les **lignes informatives** (`info_*`) restent dans le journal : elles ne sont pas des écritures (pas de jambes, aucun effet sur les livres), mais le calendrier des prêts et les avertissements du joueur les lisent.

**Un flux entre deux acteurs : une écriture par acteur, reliées (DÉCIDÉ)**

Aujourd'hui déjà, un flux entre deux acteurs est écrit en deux lignes, une par compte, chacune avec son `counterpartyBuildingId` (le loyer : `rent_paid` chez le locataire et `rent_received` chez le propriétaire, `SettleHouseRents` ; l'impôt : `corporate_tax` chez l'entreprise et `corporate_tax_revenue` chez la ville, `corporateTaxLines`). On garde ce modèle, qui est celui du PCG : chaque personne tient ses propres livres.
- Chaque écriture appartient à un seul compte et s'équilibre dans ce compte. La purge, l'idempotence par clé métier et le bilan restent par compte, sans exception.
- Les deux écritures d'un même flux portent le même `transactionId` (la clé métier sans le titulaire) en plus de `counterpartyBuildingId`.
- La consolidation (étape 5) additionne tous les comptes, puis retire les jambes des couples dont le `transactionId` a une écriture de chaque côté. Une moitié manquante est une erreur qui nomme le `transactionId`.
- Un flux sans contrepartie dans le jeu (le marché, la banque, un achat à l'étranger) est déclaré comme tel au catalogue : une moitié manquante n'est jamais silencieuse.
- Trous constatés à combler avec ce travail : un impôt ou une cotisation non payés sont aujourd'hui écrits sans créancier (`creditorId: null`), donc la ville n'a pas sa créance ; les achats de marchandises et l'entretien sans propriétaire n'ont pas de créancier non plus. La ville écrit sa créance ; les autres sont déclarés « sans contrepartie » au catalogue.

**Le catalogue en jambes : décisions prises**
1. **Les recettes de la ville sont des produits (classe 7), pas des comptes de tiers (classe 4).** Aujourd'hui le catalogue range ce que la ville perçoit en 444, 447, 4457, 431, 4421 : un impôt reçu y est une dette envers le contribuable, ce qu'il n'est pas. Le PCG ne couvre pas un organisme public : la ville et les hameaux suivent le plan de comptes **M57** (abrégé, 1er janvier 2026, lui-même bâti sur le PCG ; document : `collectivites-locales.gouv.fr`, « M57A Plan de comptes 01012026 »), les entreprises, la SCI et les coopératives restent au PCG. Une première proposition de numéros « à nous » dans le 73 était fausse : en M57, 732 est la fiscalité reversée, 733 celle d'Île-de-France et 735 la fraction de TVA. Les comptes de la ville, relus dans le plan :
   - **Capitaux** : les fonds de départ de la ville sont des dotations, `1021` (pas `101`) ; résultat `12`, report à nouveau `110`/`119` (déjà ceux du plan) ; emprunts `1641`.
   - **Recettes** : impôt des habitants `73111` impôts directs locaux ; impôt sur les bénéfices des entreprises `73118` autres contributions directes (le plus proche de l'esprit, aucun compte M57 ne le nomme) ; prélèvement à la source des ménages `738` autres impôts et taxes (c'est l'impôt de l'État dans le réel, un choix de jeu) ; restitution de cet impôt `7398` ; TVA `735` fraction de TVA ; droits de douane `7343` taxe due à l'entrée des marchandises ; loyers perçus `752` revenus des immeubles.
   - **Cotisations sociales** : ce ne sont pas des recettes de la ville (une dette envers l'organisme social) : on les range en `431` sécurité sociale / `437` autres organismes sociaux, classe 4, et l'allocation chômage se paie sur ce compte, sans toucher au résultat (DÉCIDÉ).
   - **Charges** : salaires `6411` ; allocation chômage selon le point précédent ; aides aux entreprises `65742`, aux ménages `65741`, aux services `65738` ; intérêts `66111` ; entretien `615221` bâtiments publics ; créance irrécouvrable `654` (déjà le compte prévu pour la liquidation) ; dotation aux amortissements `6811`, amortissements `28131`.
   - **Actif** : bâtiments publics `2131`, voirie `2151` ; titres de participation `261` (la ville dans la SCI et dans les entreprises) ; subventions d'investissement reçues `13`.
   Le catalogue déclare, pour chaque type, le plan (PCG ou M57) de son compte propriétaire. Le journal, les écritures, le pli, la clôture et la consolidation sont les mêmes. À relire avant d'écrire.
2. **Payé comptant ou constaté à l'échéance.** Une charge payée tout de suite est une seule écriture (D charge / C 512). Une charge que l'entreprise ne peut pas payer est constatée à l'échéance (D charge / C dette : 421, 431, 444, 401), puis réglée plus tard (D dette / C 512) : c'est ce que fait l'étape 4a, sans le préfixe `od_`. Pas de double écriture systématique (volume).
3. **La paie est une écriture à plusieurs jambes** (journal `PA`, une par employeur et par mois) : D 6411 brut et D 645 cotisations patronales ; C 421 net, C 431 cotisations, C 4421 prélèvement. Le salaire est ensuite réglé en D 421 / C 512. Elle remplace `producer_wage`, `employer_contribution`, `employee_contribution`, `payroll_tax`, `social_contribution`.
4. **Les lignes purement informatives** (`info_rent_due`, `info_premises_rent_due`, …) ne sont pas des écritures : elles quittent le journal (la dette est déjà dite par l'écriture de dette).
5. **La construction.** La ville inscrit son apport à la SCI en titres de participation (D 261 / C 512), pas en immobilisation (213) ; la SCI inscrit le bâtiment en 213 contre son capital (101, `od_asset_contribution`). Sinon le bâtiment est compté deux fois à la consolidation. Les routes restent à la ville (213, sans contrepartie).
6. **Le ménage** n'est pas une entité du PCG mais reste une contrepartie : il garde ses comptes miroirs (421, 437, 447, 4421, 275, 768, 607, 6132).
7. **La TVA** (constat dans `serviceSaleLines` et `RecordConsumerPurchases`) : le ménage paie le TTC, l'entreprise ne reçoit que le HT et la ville reçoit la TVA directement du ménage, trois écritures reliées par le même `transactionId` (ménage D 607 / C 512 pour le TTC ; entreprise D 512 / C 707 pour le HT ; ville D 512 / C 735 pour la TVA). La TVA ne passe donc pas par l'entreprise (ni 4457 collectée, ni 4456 déductible) : c'est une simplification de jeu assumée, qui n'ajoute aucune écriture. Les achats entre entreprises sont HT. Un flux relie ainsi N écritures et non deux : la consolidation retire les jambes de tout groupe de même `transactionId`, pas seulement des couples. À relire : si la TVA doit un jour passer par l'entreprise, c'est une règle de jeu, pas de comptabilité.

### Étape 1 — Postings dérivés : Journal, Grand livre, Balance (FAIT)

Réalisé : `AccountLedgerPolicy.js` (`postingsOf`, `accountLedgerOf`, `trialBalanceOf`), `getBuildingLedger`, pastilles « Grand livre » et « Balance » de l'onglet Finances d'une entreprise, test `accountLedger.test.js`. Comme chaque ligne du journal est une seule jambe d'argent, la banque est toujours l'autre jambe : le catalogue n'a gagné qu'un champ `counter`, pour les dépôts et retraits (275 côté déposant, 165 côté banque, 768 pour l'intérêt d'un ménage). La balance équilibre par construction : la vérification utile est le rapprochement du solde de 512 avec la trésorerie, qui lève une erreur au moindre écart. Elle ne deviendra non triviale qu'avec les OD de l'étape 2.

Prévu à l'origine :
- Étendre `PcgJournalCatalog` : chaque type déclare `debit` et `credit` (comptes). Un type sans posting lève une erreur.
- Fonction pure `postingsOf(entry)` → liste de `{ account, debit, credit }`.
- Grand livre : postings regroupés par compte, par acteur (entreprise, hameau). Balance : soldes débiteurs et créditeurs par compte.
- Contrôle : le total des débits égale celui des crédits. Un écart nomme la ligne ou le type mal classé.
- Le compte 512 (banque) devient le solde de la trésorerie : `moneyDirectionOf` et la balance doivent s'accorder (règle « un seul solde »).
- Présentation : trois lectures du compte, Journal, Grand livre, Balance, à côté du compte de résultat et du bilan.
- Aucune écriture de plus, aucune migration. Test de non-régression : la balance équilibre sur un journal d'exemple et un type sans compte lève une erreur.

### Étape 2 — Clôture mensuelle : variation de stock, amortissement (FAIT)

Réalisé : règle du journal réécrite dans `CLAUDE.md` (mouvements de valeur : argent ou OD) ; OD déclarées dans `PcgJournalCatalog` (`od_stock_up|down_merchandise|production`, `od_depreciation`) ; `CloseMonthAccounts` écrit une fois par compte et par mois, après le règlement du mois (`ProcessTurnBudget`) ; `MonthClosingPolicy` ; `DEPRECIATION_YEARS` (maisons 30 ans, fermes et marchés 20, industrie 25 : premières valeurs) ; le compte de résultat gagne « Variation de stock », « Production stockée » et « Dotations aux amortissements » (la CAF ajoute l'amortissement, la valeur ajoutée tient compte du stock) ; grand livre et balance incluent les OD ; le bilan lit les OD (amortissements 281, variation de stock en cours = stock du moment moins stock déjà posté). Test : `monthClosing.test.js`.
Limites connues : une purge d'année replie les OD sans les garder (le stock posté et l'amortissement cumulé repartent de zéro, l'équilibre reste mais l'historique est perdu : étape 3) ; (la sortie d'actif d'un bâtiment démoli est faite, voir plus bas) ; le bilan d'un mois passé n'est pas encore proposé (les OD le permettent, la vue ne le fait pas).

Prévu à l'origine :
- Inventaire **intermittent** : on ne passe pas le stock en inventaire permanent (une écriture par livraison serait lourde). À la clôture du mois, une OD porte la variation de stock (603 / 71) et conserve la valeur du stock en fin de mois : le bilan d'un mois passé devient possible.
- Amortissement des constructions de la SCI : durée par type de bâtiment déclarée au catalogue, dotation mensuelle (681) en OD, amortissement cumulé (281) au bilan.
- Écrites une fois par entreprise et par mois, en un seul `bulkAdd` dans une transaction avec le reste du règlement mensuel.
- **Règle à changer dans `CLAUDE.md`** : « le journal ne contient que des mouvements d'argent » devient « tout mouvement de valeur » ; une OD ne bouge pas l'argent (`moneyDirectionOf` renvoie null) mais a ses postings. À rédiger avant de coder.

### Étape 3 — Clôture annuelle compatible avec la purge (FAIT)

Réalisé : `year_closing` porte désormais, en plus du flux net et des totaux par type (qui incluent les OD), les **soldes des comptes de bilan** (`balances`, débit moins crédit), le **résultat** de l'année et le **coût de construction** de chaque bâtiment (`constructions`, nécessaire à l'actif et à l'amortissement de la SCI). Le grand livre poste ces à-nouveaux contre le compte 12 ; le bilan les relit (capital, emprunts, immobilisations, amortissements, stock posté, résultat) : une purge ne change ni la trésorerie ni le bilan. L'affectation du résultat est dérivée, rien n'est écrit : le bilan sépare « Report à nouveau » (les années passées) de « Résultat de l'exercice » (l'année en cours) ; les dividendes restent les lignes `enterprise_dividend` déjà écrites à la clôture de l'exercice. Le compte de résultat d'une année purgée se lit désormais depuis ses totaux (il restait vide). Tests : `balanceSheet.test.js` (la purge laisse le bilan identique), `accountLedger.test.js`.
Limites : une clôture écrite avant cette étape (sans `balances`) lève une erreur au lieu d'être lue (pas de migration) ; la répartition des à-nouveaux n'a qu'un compte « 12 » (résultat reporté), pas de distinction 110/119 .

### Sortie d'actif d'un bâtiment démoli (FAIT)

La SCI survit à la démolition : elle doit sortir le bâtiment de ses livres, comme dans le réel. La clôture du mois écrit, bâtiment par bâtiment, des OD (`od_asset_contribution` : 213 contre le capital 101 quand un bâtiment entre ; `od_asset_disposal_amortization` : 281 soldé ; `od_asset_disposal_loss` : valeur nette en charge 675 quand il sort). Le capital reste ce que la ville a apporté : la perte passe dans le résultat, le capital ne baisse pas. Ce que les livres portent par bâtiment (`postedAssetsOf`) se lit dans les OD et dans les à-nouveaux des années purgées (`closing.assets`) ; le type d'un bâtiment démoli se lit sur sa ligne de construction (`Building: <type>`), gardé dans la clôture. Cette lecture remplace le calcul « apport = coût des bâtiments en place » du bilan : l'actif, le capital, l'amortissement et la perte sont désormais des écritures, donc visibles au grand livre et à la balance de la SCI. Les routes restent à la ville (ni apport, ni loyer, ni amortissement). L'amortissement soldé suit la formule jusqu'à la clôture précédente (pas de dotation du mois de la démolition). Test : `monthClosing.test.js`.

Prévu à l'origine :
- Affectation du résultat : report à nouveau (110 / 119), dividendes (457).
- `year_closing` garde aujourd'hui le flux net de l'année. Avec un bilan, il doit conserver les **soldes des comptes de bilan** (à-nouveaux : capital, immobilisations, stock, emprunts), sinon la purge détruit les capitaux et les stocks. C'est le point le plus délicat à ne pas rater. La règle « la purge ne change jamais la trésorerie » reste vraie.

### Étape 4 — Créances et dettes (en dernier)

Plan détaillé, avec la faillite : `docs/gameplay/PLAN_BANKRUPTCY_PAYABLES.md` (4a dettes d'exploitation impayées, FAIT, avec un capital de départ versé par la ville aux entreprises ; 4b liquidation et fin de partie, à faire ; garantie des salaires par la ville, 3 mois de grâce, liquidation automatique). Le crédit commercial entre entreprises reste hors de cette étape.

Prévu à l'origine :
- Séparer la facture du paiement : clients (411), fournisseurs (401), TVA collectée (4457) et déductible.
- C'est un changement de règle de jeu : retards de paiement, impayés, faillite possible. Les loyers impayés en sont le précédent.
- À ne faire que lorsque le jeu aura besoin du crédit entre acteurs.

### Étape 5 — Hameau et ville : bilan et consolidation
- Comptabilité publique pour le hameau (sans stock ni capital) : excédent ou déficit, immobilisations publiques, emprunts.
- Ville = somme des hameaux, avec élimination des flux internes (une ligne est un produit d'un côté, une charge de l'autre). Chaque acteur calcule ses postings à partir de la même ligne ; sinon la consolidation compte deux fois.
- Particulier : un patrimoine (dépôt, dettes), pas de bilan PCG.

## 4. Performance et IndexedDB

- **Volume.** Les régularisations se font à la clôture mensuelle, pas à chaque tour : environ 50 bâtiments × 3 écritures par mois, soit environ 150 lignes par mois. C'est négligeable face à la traçabilité de l'approvisionnement, qui écrit à chaque transfert.
- **Regroupement des écritures.** Chaque ligne du règlement est écrite à part aujourd'hui. Un règlement mensuel groupé en un seul `bulkAdd` dans une transaction est le gain principal.
- **Lecture.** Le bilan et le grand livre relisent tout le journal à chaque ouverture. Prévoir un cache en mémoire reconstruit au chargement, jamais stocké dans la base, et un index par compte : le journal reste le seul enregistrement, conformément à « jamais de chiffre dérivé stocké ».
- **Durée d'un mois.** Les écritures mensuelles dépendent de `getDaysPerMonth()` ; rien n'est écrit en dur.

## 5. Limites et arbitrages

- **Fidélité contre complexité.** La double entrée complète (option 1) est la plus fidèle mais coûte le plus. Les postings dérivés donnent la balance et le grand livre sans rien réécrire ; les OD ajoutent seulement ce qui n'a pas d'argent.
- **Inventaire intermittent contre permanent.** L'intermittent est celui des petites structures, léger et pédagogique ; le permanent suivrait chaque livraison.
- **Pas tout le PCG.** Le jeu n'implémente que les comptes qu'il fait vivre.
- **Pas de rétroactivité.** Aucune migration de partie existante : un journal sans postings ou sans OD lève une erreur.

## 6. Ordre et décision

1. Étapes 1 à 3 et 4a : faites sur le modèle à une jambe.
2. Étape 0 : les règles de `CLAUDE.md` sont réécrites (fait) ; le code suit en un bloc.
3. Étape 5 (le livret et le bilan de la ville lisent le même pli), puis 4b (la liquidation écrit chez la ville et la SCI : perte sur créance, fonds de garantie).

L'étape 0 et les étapes 1 à 5 sont faites. Prochain pas : la liquidation et la fin de partie (étape 4b, voir `PLAN_BANKRUPTCY_PAYABLES.md`), qui demande d'abord des choix de jeu ; la paie en comptabilité d'engagement chez l'entreprise reste facultative.
