# Plan — qui possède quoi

État des lieux du 2026-11-08 (lu dans le code), pour décider de la suite. Rien de nouveau n'est construit ici.

## Ce qui est fait

**Les entreprises**
- La ville est la seule actionnaire d'une entreprise. Capital de fondation : 261 pour la ville, 101 pour l'entreprise, jamais rendu (`FundNewCompanies`).
- Fonds de roulement en trois formes (`CompanyAidCatalog`) : participation (capital sans retour), prêt (274 / 164), actionnaire d'État (capital qui donne une part, donc un dividende en janvier).
  La part se calcule (parts détenues sur parts émises, prix de la part = fonds propres sur parts), elle ne s'écrit pas.
- À la liquidation, le capital revient à la ville dans la mesure de la caisse, le prêt est remboursé d'abord, le reste est perdu.
- Les activités des maisons (coopératives) partagent leur excédent entre les habitants (`CooperativeAllocationPolicy`, formes juridiques).

**Les bâtiments**
- Un bâtiment public est construit par la ville (2131 « Bâtiments publics »), sans compte propre ; son entretien est celui de la ville.
- Un bâtiment qu'une entreprise exploite lui est apporté par la ville (213 contre le capital 101) ; sa démolition est une sortie d'actif.
- Les maisons appartiennent à la société propriétaire de la maison du maire (loyers, entretien porté par elle, aide de la ville), qui vend aussi les terrains.

**Les prêts**
- Chaque prêt de la ville porte `lenderBuildingId` : la banque prêteuse (créance 274 chez elle, dette 1641 chez la ville). Nul (`null`) veut dire prêteur extérieur au jeu : ses intérêts sortent du produit national (`externalInterestOf`).
- Le crédit de la banque aux entreprises (1643 / 274), le prêt de la ville à une entreprise (164 / 274), le refinancement et le prêt marginal de la banque centrale (1649, 1648), l'épargne des ménages (165 / 275) ont chacun leurs deux côtés.

## Ce qui manque

1. **Aucun registre de propriété.** Qui possède quoi n'est lisible qu'en lisant les jambes du journal ; aucune ligne de bâtiment ne dit son propriétaire, aucun écran ne répond à « à qui est ceci ? ».
2. **Les actionnaires.** Seule la ville détient des parts. Pas de table des parts (détenteur, nombre, prix), pas d'actionnaire privé (ménage, société propriétaire, ville partenaire), pas de
   cession des parts de la ville (privatisation). Le système de dividendes unifié (voir la mémoire du projet) n'existe pas : le dividende ne va qu'à la ville, et aux habitants des coopératives.
3. **Les bâtiments publics.** Leur propriétaire est implicite (aucun compte). Pas de patrimoine de l'État : ni bilan ni liste de ce que la ville détient (bâtiments 2131, participations 261, prêts accordés 274, créances 411) face à ses dettes.
4. **Les prêts, côté créance.**
   - Tout prêt de la ville a une banque du jeu pour prêteuse (le panneau refuse sinon) : les prêteurs extérieurs (villes partenaires, aide internationale, bienfaitrice) n'existent pas, la branche `lenderBuildingId = null` ne se déclenche jamais.
   - Aucun écran des créances (ce que la ville, la banque, les entreprises doivent recevoir) en face des dettes : chacun ne voit que ses dettes.
   - Un prêt extérieur n'a pas d'identité du prêteur, ni de conditions propres (taux de la ville prêteuse, durée, garanties).
   - Le don d'une ville partenaire est un don en capital (1025), pas une dette : le jour où une ville prête, il faudra un prêt de plus.
5. **Les ménages** ne détiennent rien d'autre que leur épargne : pas de parts, pas de prêt, pas de logement (ils sont locataires de la société propriétaire).

## Fait le 2026-11-08 (étapes 1 et 2)

1. **Le registre** (`OwnershipRegisterPolicy`, `accounting.getOwnershipRegister`, lu du journal et des bâtiments, rien de stocké) et la section « Patrimoine » du panneau d'administration : les entreprises et qui détient leur capital (la ville, sa part des dividendes),
   les bâtiments et leur propriétaire (maison : société propriétaire ; entreprise : elle-même ; autre : la ville), et toutes les dettes avec leur créancier et leur débiteur, filtrables (« ce que la ville doit », « ce qu'on doit à la ville »). Les dettes lues : prêts de la ville,
   crédit de la banque aux entreprises, prêts de la ville aux entreprises, refinancement, épargne, impayés de l'État, dettes des entreprises. Un bâtiment disparu qui est encore dû ou débiteur s'affiche « … » avec un avertissement.
2. **Les prêteurs nommés** : `ExternalLenderCatalog` (les villes partenaires, par ordre de priorité, écart de taux et plafond propres) ; un type de prêt `external` (écart de base + celui du prêteur) ; le panneau des prêts liste les villes qui prêtent (celles avec qui la ville commerce),
   un prêt nomme sa ville prêteuse dans son contrat (`lenderCityId`, `lenderCityName`), sans banque ni réserves (c'est de l'argent étranger, converti par la banque centrale), sous le plafond d'endettement. Intérêts et remboursements sortent de l'économie (`externalInterestOf`).

Limites : l'onglet Finances d'une entreprise montrait déjà la part de la ville ; le registre ne montre pas encore la part des habitants dans les coopératives ; les lignes de dette n'ont pas de tri par montant.

## Fait ensuite (étapes 3 et 4 et les coopératives)

3. **Actionnaires privés et dividendes** : la ville vend ses parts à la société propriétaire (`SellCityStake`, depuis la fiche de l'entreprise, onglet Finances) à ce qu'elles lui ont coûté ; les lignes `stake_sold` / `stake_bought` portent les parts ; `sharesHeldIn` lit qui les détient ; en janvier chaque détenteur reçoit sa part des dividendes
   (`state_dividend_*` pour la ville, `private_dividend_*` pour un privé) sur ce que la caisse de l'entreprise permet. Limites : le seul acheteur est la société propriétaire ; pas de rachat ni de prix de marché.
4. **Bilan de la ville** (`StateBalanceSheetPolicy`) : ce qu'elle détient face à ce qu'elle doit et son résultat, lu des totaux de son compte, deux côtés qui s'accordent ou une erreur ; dans la section Patrimoine.
5. **Coopératives** : les maisons qui ont une activité propre sont listées avec leurs propriétaires (leurs habitants).

## Suite proposée

1. **Le registre, dérivé du journal** (rien n'est stocké) : une requête « possède » qui rend, pour chaque entreprise sa table des parts, pour chaque bâtiment son propriétaire (ville, société propriétaire, entreprise), pour chaque prêt son prêteur et son emprunteur. Un écran « Patrimoine » dans le panneau d'administration, et l'onglet Finances d'une entreprise qui dit ses actionnaires.
2. **Le prêteur nommé.** Un catalogue de prêteurs extérieurs (les villes partenaires, par priorité comme les bienfaitrices), un prêt qui nomme son prêteur, et l'écran des créances face aux dettes.
3. **Les actionnaires privés et les dividendes unifiés** : la table des parts accepte d'autres détenteurs, un seul mécanisme de dividende (le résultat d'un compte partagé entre ses détenteurs), la cession des parts de la ville.
4. **Le bilan de l'État** : ce qu'il détient face à ce qu'il doit, lu du même pli que les autres.
