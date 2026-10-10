# Économie : document de reprise

État au moment de la reprise. À lire avant de toucher au règlement mensuel, aux achats ou à l'impôt.

## 1. Principes posés (décisions prises avec le joueur)

- **Un seul canal : le journal.** Tous les mouvements d'argent y sont, avec un compte. Le journal « Hameau » (la ville) est
  le sous-ensemble sans compte ; « Flux privés » est le sous-ensemble avec compte. Pas de seconde source d'argent.
- **Trois sortes de comptes** : la ville (aucun compte), une entreprise (son bâtiment), une maison qui a deux comptes :
  **particulier** (salaires perçus, biens et services payés, IR, allocations) et **entreprise** (ce qu'elle vend).
- **Le foyer = la maison.** L'IR et le budget se calculent par foyer. Les habitants sont les sources de revenu.
- **Prix** :
  - **biens** : le prix du catalogue est **TTC**. La maison paie le TTC ; le vendeur reçoit le **HT** ; la ville reçoit la
    **TVA** extraite du TTC. La TVA n'est due qu'une fois, sur la vente finale.
  - **services** : le prix du catalogue est **HT**. La subvention se déduit du HT ; la TVA est ajoutée sur la part payée
    par la maison. La maison paie le TTC de sa part, l'entreprise vend le HT, la ville reçoit la TVA.
- **Subvention** : déduite du prix HT (une subvention ne porte pas sur un impôt). Une subvention de 100 % donne 0 € à la
  maison, sans ligne.
- **Calendrier** : salaires et services sont réglés le **1er jour du mois suivant** (ils portent sur le mois précédent).
  Les biens sont payés **à chaque livraison**.
- **Budget d'achat** d'une maison = épargne reportée + salaire net du mois précédent − services du mois précédent.
  L'épargne se lit au compte ; un solde négatif s'appelle une **dette**.
- **Insolvabilité** : une facture de service que la maison ne peut pas payer la coupe de ses autres services pour le mois.
  Elle est affichée « insolvable » ; un service absent affiche « inexistant ».
- **IR** : progressif, fixé à trois tranches (`FiscalRateCatalog.js`) : exonéré sous `salaryTaxThreshold1`, `salaryTaxRate1`
  sur la part entre les deux seuils, `salaryTaxRate2` sur la part au-dessus de `salaryTaxThreshold2` — chaque tranche ne
  taxe que sa propre part (`withholdIncomeTax`, `ProducerChargePolicy.js`). Réglable par hameau dans le panneau admin.
- **Allocation chômage** : imposée comme un salaire — fondue dans le même total mensuel du foyer avant l'IR, mêmes
  tranches, pas de seuil ni de taux distinct.
- **Fonctionnaires** : employés directement par la mairie, sans bâtiment. Ils reçoivent le salaire de référence sur leur
  compte particulier, et ce salaire est imposé à l'IR.

## 2. Les flux, un par un

| Flux | Qui paie | Qui reçoit | Quand | Où dans le code |
| --- | --- | --- | --- | --- |
| Bien acheté par une maison | maison (`consumer_purchase`, particulier, TTC) | vendeur (`producer_revenue`, HT) + ville (`vat`) | à la livraison | `RecordConsumerPurchases.js`, hook `onDistribute` dans `createSupplyContext.js` |
| Service vendu à une maison | maison (`service_purchase`, TTC) | entreprise (`service_sales`, HT) + ville (`vat`) | règlement, 1er du mois | `SettleProducerCharges.js`, `ProducerChargePolicy.serviceSaleLines` |
| Subvention de service | ville (`service_subsidy`) | entreprise (`service_subsidy_received`) | règlement | idem |
| Salaire d'entreprise | entreprise (`producer_wage`) | maison (`household_wage`, brut) | règlement | `wageSplitLines`, `SettleProducerCharges.js` |
| Salaire de fonctionnaire | ville (`salary`) | maison (`public_wage`, brut) | règlement | `householdPublicPayOf`, `SettleProducerCharges.js` |
| Allocation chômage | ville (`unemployment_benefit`) | maison (`household_benefit`) | règlement | idem |
| IR sur le total du foyer | maison (`income_tax`, particulier) | ville (`payroll_tax`) | règlement | `withholdIncomeTax`, fin de `execute` |
| Impôt citoyen | chaque maison imposable (`citizen_tax_paid`, particulier) | ville (`citizen_tax`, somme forfaitaire) | Novembre, 1×/an | `computeCitizenTaxByHouse`, `CollectCitizenTaxes.js` |
| Impôt sur les sociétés | entreprise (`corporate_tax`) | ville (`corporate_tax_revenue`) | règlement | `buildingChargeLines` |
| Entretien | entreprise ou ville | ville | règlement | `buildingChargeLines` |
| Achats entre entreprises | acheteur (`producer_purchase`) | vendeur (`producer_revenue`) | règlement | `tradeLines` |
| Clôture annuelle | — | — | purge | `YearClosingPolicy.js`, une ligne par (hameau, année, compte) |

**Ordre dans le règlement** (`SettleProducerCharges.execute`) : ventes entre entreprises → factures de services (payées
ou coupées) → salaires publics et allocations → salaires et subventions par entreprise → IR par foyer → charges des
entreprises. Le salaire dépend des ventes, les ventes dépendent des factures payées, qui dépendent du salaire net : le
calcul se résout par itération (`#planMonth`), l'ensemble des factures payées ne pouvant que diminuer.

## 3. Où sont les réglages (panneau admin, « Impôts » et « Services »)

- **Par hameau** (`HamletFiscalRateRepository`, bornes dans `FiscalRateCatalog.js`) : salaire de référence
  (`salaryPerMonth`), les trois tranches de l'IR (`salaryTaxThreshold1`, `salaryTaxRate1`, `salaryTaxThreshold2`,
  `salaryTaxRate2`), taux de l'allocation (`unemploymentBenefitRate`), TVA par catégorie, subvention par service.
- **Ville** : impôt par citoyen, droits de douane.

## 4. Ce qui est en place, par fichier clé

- Comptes et journal : `AccountKeyPolicy.js`, `SessionJournalStore.js`, `RecordLedgerEntry.js`.
- Trésorerie et compte : `GetTreasurySnapshot.js`, `TreasuryFromJournalPolicy.js` (sens des types).
- Fiches : `buildingFinanceInfoView.js` (compte d'exploitation, budget du mois, réconciliation, couleurs produits/charges),
  `houseResidentsInfoView.js` (liste des habitants), `buildingInfoGroupRegistry.js` (onglets par groupe).
- Habitants : `HouseResidentsPolicy.js` (un enregistrement par habitant, dérivé des compteurs),
  `CitizenNameCatalog.js` (prénoms), `HouseholdPublicPayPolicy.js` (fonctionnaires et chômeurs par foyer),
  `HouseResidentsPayPolicy.js` (part de chaque habitant, relue du journal, jamais recalculée).
- Emploi/population : `computeCityEmploymentSummary.js`, `computePopulationBreakdown.js`
  (`computeHouseholdEmploymentStatus`, la règle par foyer partagée avec la compta).
- Distribution des biens : `RoundRobinDistribution.js` (plafond par solde, achat partiel, motifs), `DistributeResourceToConsumers.js`
  (`#recordShortfalls`, coupure des services).
- Classement des producteurs : `GetProducerRevenues.js` (lit le journal, HT, ventes aux maisons).
- Formatage : `formatMoney.js` (deux décimales, arrondi commercial) ; tous les montants affichés passent par lui.

## 5. État des tests

- **Dernière exécution complète verte** : 228 suites, 1450 tests (après la tâche 4 ci-dessous).
- **Pas encore joué** : les tâches 1 à 4 n'ont pas été vérifiées dans `pnpm dev` (seulement par les tests).

**À faire en premier** : une partie neuve (ou un préfab) pour regarder un mois complet, en particulier l'onglet
Habitants (tâche 1) et le compteur de chômeurs du HUD comparé aux foyers (tâche 2).

## 6. Reste à faire (ordre proposé)

1. ~~**Payer chaque habitant**~~ — fait. `HouseResidentsPayPolicy.residentPayBreakdownOf` relit les lignes déjà
   inscrites du mois (`household_wage` par lieu de travail, `public_wage`, `household_benefit`) et les répartit par
   habitant (dernier absorbe le centime) ; rien n'est recalculé ni réécrit au journal. Câblé dans
   `createAccountingContext.js` (`getHouseResidents`, qui n'était d'ailleurs pas exposé sur le contexte retourné —
   corrigé au passage) et affiché dans `houseResidentsInfoView.js` (« Pas encore réglé » si le mois n'est pas encore
   passé en règlement). Test : `tests/contexts/accounting/houseResidentsPayPolicy.test.js`.
2. ~~**Une seule source pour les chômeurs**~~ — fait. `computeCityEmploymentSummary` additionne maintenant le
   fonctionnaire/chômeur de chaque foyer (`computeHouseholdEmploymentStatus`, nouvelle fonction dans
   `computePopulationBreakdown.js`), au lieu d'un floor sur le total ville ; une maison sans accès routier compte
   quand même (décision : le foyer est la seule source, l'accès routier ne concerne que l'appariement à un emploi).
   `EmploymentBuildingSnapshot` porte désormais `workerSources` ; les deux points de construction du snapshot
   (`DexieEmploymentBuildingRepository`, `hudPopulationAggregates.js`) le renseignent. Tests étendus dans
   `tests/contexts/employment/getCityEmploymentSummary.behavior.test.js`.
3. ~~**Nettoyage du modèle de référence**~~ — fait. `RecordSalaryExpense.js`, `RecordUnemploymentBenefitExpense.js`,
   `RecordPayrollTaxIncome.js`, `CivilServantSalaryPolicy.js`, `UnemploymentBenefitPolicy.js`, `buildVatBusinessKey`
   et les méthodes mortes de `GameTreasuryRecording` sont supprimés, avec leur câblage dans `createAccountingContext.js`
   /`accountingOps.js`/`accountingGameOps.js` et leurs tests.
4. ~~**Entreprises des maisons**~~ — à moitié vrai, corrigé en partie (2026-10-10). La production existait déjà
   (`activityRecipe`/`ARTISAN_ACTIVITY_ROLES`/`SAVANT_ACTIVITY_ROLES`/`MERCHANT_ACTIVITY_ROLES`,
   `buildingEconomy.js`) : une maison vend bien à un entrepôt via `sumGoodsFlowsByPair` → `tradeLines`. Mais
   `tradeLines` ne posait jamais `accountKind` : l'argent d'une maison-vendeuse tombait sur la clé nue `houseId`,
   une troisième clé jamais lue par personne — ni « Particulier » ni « Entreprise » (`buildingFinanceInfoView.js`,
   qui filtre `accountKind` exactement) ne la montraient. Corrigé dans `SettleProducerCharges.js` : chaque ligne de
   `tradeLines` reçoit maintenant `accountKind: 'entreprise'` quand son `holder` est une maison (`houseIds`, tiré de
   `listHouses()`), sinon `null` comme avant pour une entreprise. Test :
   `tests/contexts/accounting/houseBusinessAccount.regression.test.js`. Reste non fait : aucune maison n'a encore
   `employment.workerNeed` pour sa propre activité (elle ne salarie personne), et le sous-onglet Entreprise n'a pas
   été vérifié dans `pnpm dev`.
5. **Performance** : le solde de chaque maison est lu sur tout le journal à chaque passe de distribution. Prévoir un cache
   par tour si une grande ville ralentit.
6. **Round-robin** : la part d'une maison qui ne peut pas payer n'est pas redistribuée dans la même passe.
7. ~~**Date des services**~~ — panneau construit (2026-10-09). Le classement des producteurs (`GetProducerRevenues.js`,
   jusque-là câblé mais jamais affiché) est maintenant affiché dans le panneau admin, section Finances
   (`FinancesSectionPresenter.js`, `game.html` bloc `#producer-ranking`) : le mois affiché est le dernier mois
   révolu, avec une note explicite au joueur sur le décalage — un bien est daté du jour de sa livraison, un service
   du jour de son règlement (1er du mois suivant sa consommation), donc les ventes de services affichées sont
   celles de l'activité du mois précédent. Le décalage lui-même n'est pas corrigé, seulement expliqué. Test :
   `tests/contexts/accounting/getProducerRevenues.test.js`.
8. ~~**Chômage imposé ?**~~ — fait (2026-10-09). L'allocation est pliée dans `grossByHouse` avant le calcul de l'IR
   (`SettleProducerCharges.execute` et `#planMonth`), aux côtés du salaire et de la paie des fonctionnaires : même
   assiette, mêmes tranches. Test : `tests/contexts/accounting/incomeTaxOnBenefit.regression.test.js`.
9. ~~**Tranches de l'IR**~~ — fait. Trois tranches fixes (`salaryTaxThreshold1/2`, `salaryTaxRate1/2`) dans
   `FiscalRateCatalog.js`, calcul progressif dans `withholdIncomeTax` (`ProducerChargePolicy.js`), curseurs dans le
   panneau admin « Impôts » (`TaxesSectionPresenter.js`). Test : `tests/contexts/accounting/incomeTax.regression.test.js`.
10. **Idée (non décidée, 2026-10-09) — la main d'œuvre d'un service ne limite rien.** Un bâtiment de service
    (`consumption: 'flag'`, `buildingEconomy.js`) a un `employment.workerNeed` fixe (École: 3, Médecin: 2, Hôpital: 4,
    ...) et `range: Infinity` : qu'il soit à 1/3 ou 3/3 employés, il "flague" quand même toutes les maisons à portée
    comme desservies ce mois-ci (`DistributeResourceToConsumers.js#distributeFlag`, aucun stock, aucun plafond).
    Le staffing n'affecte que le salaire versé et les stats d'emploi, jamais la couverture réelle.
    Piste : faire dériver une capacité du nombre d'employés réellement en poste (ex. capacité = employés × un
    forfait d'heures/bénéficiaires par employé), et ne "flaguer" que jusqu'à cette capacité par période — la
    couverture d'un service deviendrait alors une vraie quantité (nombre de bénéficiaires que le personnel peut
    effectivement prendre en charge), au lieu d'un flag binaire indépendant du personnel. C'est un changement de
    mécanique de jeu (capacité, répartition des bénéficiaires non servis), pas un simple refactor technique — à
    explorer plus tard, pas commencé.

## 7. Questions ouvertes pour demain

- Le paiement par habitant : confirmer que la répartition se fait au prorata des travailleurs par lieu, comme aujourd'hui.
- Source unique du chômage : le compteur de la ville se déduit-il des foyers, ou l'inverse ?
- Le cas « tout au-dessus du seuil » n'a pas été retenu : nous avons pris la règle par tranches (la part au-dessus seulement).
- Les services sont-ils soumis à une règle par habitant (un habitant insolvable n'a pas le service) plutôt que par foyer ?
