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
- **IR** : seuil d'exonération (€/mois, par défaut 0) puis **taux** (10 % par défaut) sur la part du total mensuel du foyer
  **au-dessus du seuil**. Pas de tranches encore : elles viendront comme données du catalogue fiscal.
- **Allocation chômage** : non imposée (choix provisoire).
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
  (`salaryPerMonth`), taux de l'IR (`salaryTaxRate`), seuil de l'IR (`salaryTaxThreshold`), taux de l'allocation
  (`unemploymentBenefitRate`), TVA par catégorie, subvention par service.
- **Ville** : impôt par citoyen, droits de douane.

## 4. Ce qui est en place, par fichier clé

- Comptes et journal : `AccountKeyPolicy.js`, `SessionJournalStore.js`, `RecordLedgerEntry.js`.
- Trésorerie et compte : `GetTreasurySnapshot.js`, `TreasuryFromJournalPolicy.js` (sens des types).
- Fiches : `buildingFinanceInfoView.js` (compte d'exploitation, budget du mois, réconciliation, couleurs produits/charges),
  `houseResidentsInfoView.js` (liste des habitants), `buildingInfoGroupRegistry.js` (onglets par groupe).
- Habitants : `HouseResidentsPolicy.js` (un enregistrement par habitant, dérivé des compteurs),
  `CitizenNameCatalog.js` (prénoms), `HouseholdPublicPayPolicy.js` (fonctionnaires et chômeurs par foyer).
- Distribution des biens : `RoundRobinDistribution.js` (plafond par solde, achat partiel, motifs), `DistributeResourceToConsumers.js`
  (`#recordShortfalls`, coupure des services).
- Classement des producteurs : `GetProducerRevenues.js` (lit le journal, HT, ventes aux maisons).
- Formatage : `formatMoney.js` (deux décimales, arrondi commercial) ; tous les montants affichés passent par lui.

## 5. État des tests

- **Dernière exécution complète verte** : 221 suites, 1429 tests. Elle précède les changements suivants, qui **ne sont pas
  relancés en entier** : seuil de l'IR, IR par foyer, paiement des fonctionnaires et des allocations, liste des habitants,
  suppression du flux de population.
- Ciblés et verts après ces changements : `incomeTax`, `economyRegister`, `householdPublicPay`, `houseResidents`,
  `buildingInfoGroupTabs`, les suites `tests/contexts/accounting` (132 tests).
- **Pas encore joué** : aucun des changements récents n'a été vérifié dans `pnpm dev`.

**À faire en premier demain** : `pnpm run test`, puis une partie neuve (ou un préfab) pour regarder un mois complet.

## 6. Reste à faire (ordre proposé)

1. **Payer chaque habitant** : le salaire d'un travailleur vient de son lieu de travail (au prorata de sa part de la masse
   salariale de l'entreprise, déjà calculée) ; le fonctionnaire reçoit le salaire de référence ; le chômeur, l'allocation.
   Les sommes par foyer ne doivent pas bouger : c'est une répartition, pas un nouveau calcul.
2. **Une seule source pour les chômeurs** : le compteur de la fiche population (HUD, `computePopulationBreakdown`,
   `getCityEmploymentSummary`) et le total des foyers peuvent différer d'une unité. Le compteur doit venir des foyers.
3. **Nettoyage du modèle de référence** : `RecordSalaryExpense.js`, `RecordUnemploymentBenefitExpense.js`,
   `RecordPayrollTaxIncome.js` et leurs méthodes dans `GameTreasuryRecording` ne servent plus au tour. Les wrappers
   « deprecated » de `CivilServantSalaryPolicy.js` et `UnemploymentBenefitPolicy.js`, ainsi que `buildVatBusinessKey`
   (`LedgerBusinessKeys.js`), sont sans usage.
4. **Entreprises des maisons** : aucune vente encore (les « deals » ne sont pas modélisés). Le sous-onglet Entreprise est vide.
5. **Performance** : le solde de chaque maison est lu sur tout le journal à chaque passe de distribution. Prévoir un cache
   par tour si une grande ville ralentit.
6. **Round-robin** : la part d'une maison qui ne peut pas payer n'est pas redistribuée dans la même passe.
7. **Date des services** : un service est daté du jour de son règlement (1er du mois suivant), pas du jour de livraison.
   Le classement des producteurs suit cette date. À expliquer au joueur (texte à écrire).
8. **Chômage imposé ?** Décision provisoire : non. À confirmer.
9. **Tranches de l'IR** : à ajouter comme données du catalogue fiscal, sur le modèle du seuil.

## 7. Questions ouvertes pour demain

- Le paiement par habitant : confirmer que la répartition se fait au prorata des travailleurs par lieu, comme aujourd'hui.
- Source unique du chômage : le compteur de la ville se déduit-il des foyers, ou l'inverse ?
- Le cas « tout au-dessus du seuil » n'a pas été retenu : nous avons pris la règle par tranches (la part au-dessus seulement).
- Les services sont-ils soumis à une règle par habitant (un habitant insolvable n'a pas le service) plutôt que par foyer ?
