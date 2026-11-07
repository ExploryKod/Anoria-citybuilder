# Plan — Bâtiment « Assurances » et mutuelles en concurrence

Statut : **tranche C1 faite le 2026-11-07**, le reste est à faire. Écrit le 2026-11-07, après la sécurité sociale (voir `passbycitizen.plan.md`,
« Absentéisme et sécurité sociale »). Les points marqués **À trancher** attendent une décision du joueur-concepteur.

**C1, ce qui existe** : compétence `assurance` (commerçants, tier 2, `skillCatalog.js`, `socialCategoryCatalog.js`) ; `MONEY_SKILLS` (`finance`, `assurance`) fait d'un
bâtiment sans rôle de ressource une entreprise (`ProducerChargePolicy.js`) ; entrée `Insurance` (`buildingEconomy.js`, 2x2, modèle Kenney `skyscraper-c`) avec
`companies` (`insuranceCompanies.js`, deux au départ) et `maxPerHamlet` égal à leur nombre, donc le grisage et la démolition qui libère la place utilisent la
mécanique existante du maire / de la banque centrale ; à la pose, `PlaceBuildingWithPayment` attribue le premier `companyId` libre (`buildingCompanies.js`) ;
le nom de la compagnie s'affiche dans la fiche (`buildingInstanceName`) et dans le journal de la paie et les listes comptables. Capital de fondation et aide
de la ville : déjà génériques (`isLucrativeBuilding`). Tests : `insuranceCompanies.regression.test.js`. **Non vérifié en jeu** (modèle, bouton, grisage).
**C2, ce qui existe (2026-11-07)** : étape assurance en fin de `SettleProducerCharges` (`#settleInsurance`, règles dans `InsurancePolicy.js` et `InsuranceCatalog.js`,
primes par compagnie dans `insuranceCompanies.js` : Ano 4 %, Aby 6 %, délai d'adhésion 2 mois, indemnité 60 % du salaire manqué). La prime est la
`service_purchase` du ménage / `service_sales` de la compagnie, de service `insurance` (706 côté compagnie), payée sur le net du mois **après** le versement des salaires,
seulement si le compte du ménage la couvre : sinon aucune ligne, et c'est la déchéance (le journal est la seule mémoire). L'affiliation se lit du journal : la compagnie
payée le mois précédent tant qu'elle existe, couverte après 2 primes de suite ; un nouvel adhérent rejoint la compagnie qui détient le plus par membre. Les
indemnités (`insurance_benefit`, 658, et `household_insurance_benefit`, 4372) sont plafonnées à la trésorerie de la compagnie, partagées au prorata ; la sécu choisie dans
le panneau Santé les remplace (jamais les deux). `insurance` est rangée dans le groupe de consommation « Autres biens et services » (sinon la fiche financière d'une
maison lèverait une erreur). Tests : `insurance.regression.test.js`. **Découverte** : une écriture de paie du mois livré M est datée du premier tour du mois M+1
(`ProcessTurnBudget`), donc estampillée M+1 ; la répartition des cotisations (`CloseMonthAccounts`) et l'affiliation en tiennent compte. **Reste de C2 / C3** : la faillite et
la liquidation d'une compagnie, la ré-affiliation entre compagnies (déchéance quand sa compagnie disparaît : déjà dérivée), l'équilibrage des taux.
**Faillite d'une compagnie (fait le 2026-11-07)** : le déclencheur est celui que le plan de faillite prévoyait (`PLAN_BANKRUPTCY_PAYABLES.md`, étape 4b) : des dettes d'exploitation
ouvertes `INSOLVENCY_GRACE_MONTHS` (3) mois de suite (`getInsolvency`, déjà dérivé du journal). Seul le bâtiment qui porte le fait de catalogue `liquidatedWhenInsolvent`
(l'assurance) est concerné : la faillite des autres entreprises reste à faire (étape 4b générale). Le dernier jour du mois, `LiquidateInsolventCompanies` (Gameplay,
système `gameplay.insolvency`) démolit la compagnie par le même chemin que la gomme (`bulldozeBuildingAtTile` : comptes liquidés d'abord, puis l'emprise et la ligne), annonce
`gameplay.companyLiquidated` ; `game.js` prévient le joueur, remet la carte à jour et rallume le bouton (la place est libre). Ses adhérents perdent leur affiliation d'eux-mêmes
(lue du journal) et leur délai repart s'ils en rejoignent une autre. Une démolition refusée est une erreur, jamais un abandon silencieux. Tests : `liquidateInsolventCompanies.regression.test.js`.
**Non vérifié en jeu** : la démolition automatique et la mise à jour de la scène, qui suivent le chemin de la gomme.
**C4, la loi d'assurance obligatoire (fait le 2026-11-07)** : réglage `insuranceMandatory` du hameau (panneau Santé, non par défaut). Une règle de lecture unique,
`InsuranceLawPolicy.insuranceLawStatusOf`, sert la paie et le panneau : la loi peut être votée seulement si une compagnie existe, a du personnel en poste et n'est pas en faillite
(dettes ouvertes sous `INSOLVENCY_GRACE_MONTHS`) ; sinon le choix « Oui » est grisé avec les raisons (`INSURANCE_LAW_LABELS`), et une loi déjà votée que l'assurance ne porte plus est
**suspendue** (affichée comme telle), jamais retirée en silence. **Conséquence rendue réelle** : l'adhésion était jusque-là automatique pour tout ménage salarié qui avait l'argent ; elle est
maintenant un vrai choix : sans la loi, un ménage ne prend l'assurance que s'il garde `INSURANCE_VOLUNTARY_BUFFER_MONTHS` (1) mois de salaire net en caisse après la prime, sinon il s'en
passe (et n'est pas couvert) ; avec la loi en vigueur, il paie dès qu'il le peut (et sans argent pour la prime, rien n'est écrit). Tests : `insurance.regression.test.js`.
**À équilibrer en jeu** : ce seuil d'un mois est un premier réglage, il fixe qui s'assure sans la loi.
Limites de C1 : certains libellés de listes (liquidation, quelques vues financières) disent encore « Assurances » pour les deux compagnies ; les noms des
compagnies sont de premiers noms du catalogue à renommer ; le salaire de départ de `assurance` est le salaire de base (8), à régler.

## 1. Ce qui est décidé

- Un bâtiment de service **« Assurances »** (il servira à tout ce qui est mutuelle et assurance). **Une compagnie = un bâtiment** : le catalogue en
  liste deux au départ, **Assurance Ano** puis **Assurance Aby** (`insuranceCompanies.js`), et on ne peut construire que deux bâtiments (voir §4). À ce stade deux compagnies se
  font concurrence.
- **Les employés sont les commerçants** (`merchants`), à partir du **niveau 2** de leur maison, comme les pompiers viennent des maisons de
  niveau 2 des savants. Il faut donc une compétence `assurance` (voir §3).
- Les habitants choisissent une mutuelle selon leur **pouvoir d'achat**. Une prime plus haute couvre **mécaniquement plus de mois d'absence** :
  les indemnités sont **plafonnées à ce que la mutuelle a accumulé**.
- Un **délai minimal d'adhésion** (même règle pour les deux) permet d'accumuler avant de verser.
- Une compagnie peut **faire faillite**. La ville peut la **subventionner comme n'importe quelle entreprise** (`CompanyAidCatalog`,
  `InjectCompanyAid`, aide de la ville de sa fiche).
- Une mutuelle ne paie un congé maladie **que si l'habitant a payé ses primes** : il lui faut donc un salaire.
- **Loi dans le panneau Santé** (il n'y a pas de panneau « Lois ») : l'obligation de s'affilier. **Désactivée, avec la raison affichée**, tant que le
  bâtiment n'est pas fonctionnel (construit, personnel en poste avec la compétence) ou si aucune compagnie n'est solvable.
- Pas de remboursement par la ville (il n'existe pas dans la vraie vie). La sécu (`sicknessCover: 'secu'`) existe déjà et reste un choix distinct.

## 2. Comment ça se passe en vrai

- La **sécu** verse des indemnités journalières après carence. La **mutuelle** rembourse des soins et complète ; les **arrêts** relèvent de la
  **prévoyance** (compte 645 côté employeur, `4372` Mutuelles et `4373` Caisse de retraite et prévoyance dans le plan de comptes).
- Une mutuelle vit de **cotisations** (ses produits), paie des **prestations** (ses charges) et garde des **réserves** exigées par la
  réglementation (solvabilité). Une mutuelle qui ne couvre pas ses prestations est mise sous administration provisoire : c'est notre « faillite ».
- Une cotisation prélevée à la source sur la paie est une dette de l'employeur envers l'organisme (`4372` pour une mutuelle), reversée ensuite.

## 3. Employés : la compétence `assurance`

Règles du dépôt à respecter (`CLAUDE.md`) : une compétence est accordée par **une seule** catégorie sociale, à **un seul niveau**.

- Nouvelle compétence `assurance` (`skillCatalog.js`, libellé « Assurance »). Elle est accordée par `merchants`, **tier 2**, à côté de `finance` et
  `manutention` : `skills: { finance: 1, manutention: 1, assurance: 1 }` (`socialCategoryCatalog.js`). Ce n'est pas la compétence `finance`
  (la banque) : un métier différent, donc une compétence à part.
- Un salaire de marché pour elle dans `START_WAGE_BY_SKILL` (`LabourMarketCatalog.js`), avec un niveau plus élevé que `manutention` si le
  métier doit payer mieux (une compétence = un niveau).
- Garde-fou existant : `tests/shared/population/socialCategoryCatalog.test.js` (une compétence, un fournisseur).
- Conséquence visible : les postes vacants des Assurances se lisent dans la grille du chômage des **commerçants**, sans ambiguïté.

## 4. Le bâtiment et ses compagnies

- Entrée de catalogue `Insurance` (`buildingEconomy.js`, famille `public` comme les autres services) : `employment: { sector: 2, workerNeed, requiredSkill: 'assurance' }`
  (le secteur 2 est celui des commerçants), `resourceRoles` : un rôle de service dont la catégorie (`insurance`) est déclarée dans
  `ResourceCategoryCatalog` (libellé et unité du catalogue, jamais écrits à la main).
- **Une compagnie = un bâtiment** (décidé le 2026-11-07, après vérification). Vérifié dans le code : seules les **maisons** ont des comptes d'entreprise
  multiples (`accountKind: 'entreprise:<id>'`, `SettleProducerCharges.js:430`), et ce chemin n'a ni salariés, ni dettes, ni impôt par entreprise. Tout le
  chemin « entreprise » d'un bâtiment producteur est clé sur `building.id` avec `accountKind: null` : l'impôt sur les sociétés (l. 401-420), les dettes de
  salaires, cotisations et loyer (l. 611-665, filtre `debt.accountKind === null`), la liquidation, le capital de fondation, le personnel
  (`workerSources` et `employees` par bâtiment, une seule compétence). Plusieurs compagnies dans un bâtiment demanderait de généraliser tout cela à
  « bâtiment + compagnie » : un chantier préalable à part, **écarté**. Si on le reprend un jour, la concurrence ne change pas.
- **Les compagnies sont une liste ordonnée du catalogue** (deux au départ) : identifiant, nom, forme juridique (une mutuelle est à but non lucratif :
  voir `LegalFormCatalog`, une entrée à ajouter), règle de prime. Le bâtiment `Insurance` se construit **au plus autant de fois qu'il y a de compagnies**
  (deux) ; **chaque construction crée la compagnie suivante** de la liste, puis le choix de construction est **grisé**, avec la raison affichée (« deux
  compagnies au plus »). Ajouter une compagnie = une entrée du catalogue, ce qui relève le maximum.
- **Ce mécanisme n'existe pas** : aucun type de bâtiment n'a de limite de construction aujourd'hui. Il faut un champ de catalogue (par exemple
  `construction.companies`, la liste) lu par la pose (`PlaceBuildingWithPayment`, qui refuse explicitement avec sa raison, jamais en silence) et par la
  barre d'outils (`ToolPanel`, qui grise). La compagnie d'un bâtiment est dérivée de son rang de construction parmi ceux de son type, stockée sur sa ligne
  à la pose. **À trancher** : si on démolit la première, la prochaine construction reprend-elle sa place dans la liste (oui, proposé : la liste est
  occupée par identifiant de compagnie, pas par rang).
- Elle reçoit un **capital de fondation** comme toute entreprise (`FundNewCompanies`) et, si elle porte un stock, un fonds de roulement ;
  une assurance n'a pas de stock : seulement sa réserve.

## 5. Primes, affiliation, indemnités

- **Affiliation dérivée du journal**, jamais stockée : un ménage est affilié à une compagnie s'il lui a payé sa prime les derniers mois. Le délai
  minimal d'adhésion se lit de la date de sa première prime à cette compagnie (même règle pour toutes).
- **Prime** (décidé le 2026-11-07) : un taux du salaire du ménage, propre à chaque compagnie (donnée de catalogue). Elle est **payée après coup par
  les habitants de la maison**, depuis le compte du ménage, une fois le net reçu : elle s'impute donc sur un salaire **net** (après cotisation et
  impôt retenus). Ce n'est pas un prélèvement à la source : pas de dette de l'employeur envers la mutuelle, donc pas de jambe `4372` côté employeur. Un
  ménage qui ne peut pas la payer (compte à sec) n'est pas affilié ce mois-là, et le délai d'adhésion repart de la première prime payée.
- **Indemnité** : pour un ménage affilié, après le délai, `min(ce que l'absent aurait gagné × taux de l'assureur, ce qu'il reste de la réserve)`. Si
  la réserve ne couvre pas tous les arrêts du mois, elle se partage au prorata : la compagnie ne descend jamais sous zéro. Une prime plus haute remplit
  la réserve plus vite et couvre donc plus de mois : le plafond est la seule règle de solvabilité.
- Un ménage **sans salaire** ne s'affilie pas (pas de prime possible) : il n'est pas couvert.
- Interaction avec la sécu (décidé le 2026-11-07) : **la mutuelle ne complète pas la sécu à ce stade**. Les deux couvertures sont distinctes : un
  arrêt est payé par la sécu (si elle est choisie) ou par la mutuelle de l'habitant, jamais par les deux. **Idée à faire après** : la mutuelle comme
  complémentaire (verser l'écart jusqu'à 100 % du salaire).
- Écritures dans `PcgJournalCatalog` (un type = une entrée) : prime reçue (produit de la compagnie), prestation versée (charge). La prime étant payée
  par le ménage depuis son compte (comme un achat de service), elle suit le chemin de `service_purchase` / `service_sales` pour la compagnie.
  **Le compte du produit d'une mutuelle n'est pas confirmé** (§9) : aucun numéro à inventer, à vérifier avant d'écrire.

## 6. Concurrence : comment un ménage choisit

Règle déterministe, sans hasard et sans état stocké :
1. Les compagnies qu'il peut payer (prime ≤ part de son revenu fixée au catalogue) sont celles qu'il considère.
2. Il prend celle qui lui offre la plus grande **couverture**, en mois d'absence que sa réserve peut financer par adhérent.
3. Un ménage déjà affilié ne change que si une autre lui offre mieux d'un écart déclaré au catalogue (sinon les ménages changeraient chaque mois).
Le délai minimal rend le changement coûteux : c'est ce qui empêche la ronde.

## 7. La loi et ses conséquences (panneau Santé)

- Réglage `insuranceMandatory` (booléen, désactivé par défaut) à côté de `sicknessCover`. Désactivé avec une raison lisible tant que : le bâtiment
  n'est pas construit, n'a pas ses employés (compétence `assurance` des commerçants), ou aucune compagnie n'est solvable.
- Conséquences à rendre visibles : tous les salariés paient une prime (pouvoir d'achat en baisse), plus personne n'est sans couverture, et les
  réserves des compagnies se remplissent ; si le bâtiment tombe en panne alors que la loi est en vigueur, la loi se suspend et le panneau le dit
  (jamais un repli silencieux).
- La loi n'impose pas la sécu : les deux modes cohabitent (§5, interaction).

## 8. Tranches (chacune se livre et se teste seule)

| Tranche | Contenu |
|---|---|
| **C1** | Compétence `assurance`, bâtiment `Insurance` (une compagnie par bâtiment), liste de compagnies du catalogue, limite de construction (grisée avec sa raison), capital de fondation. Aucune prime. |
| **C2** | Primes, affiliation dérivée du journal, délai d'adhésion, indemnités plafonnées à la réserve, écritures PCG. Une seule compagnie (Assurance Ano, la première du catalogue). |
| **C3** | Deuxième compagnie (Assurance Aby), règle de choix du ménage (§6), faillite et aide de la ville. |
| **C4** | Loi d'obligation dans le panneau Santé, conditions de désactivation, affichage des réserves par compagnie. |

## 9. Décisions et point ouvert

Décidé le 2026-11-07 :
1. **Prime** : payée après coup par les habitants de la maison, donc imputée sur un salaire net (§5).
2. **Sécu** : la mutuelle ne la complète pas à ce stade (idée à faire après).
3. **Faillite** : une compagnie en faillite est **liquidée**, comme une entreprise démolie (`docs/gameplay/PLAN_DEMOLITION_LIQUIDATION.md`) : son capital
   revient à la ville dans la limite de sa caisse, ses adhérents perdent leur affiliation (dérivée du journal, elle disparaît d'elle-même) et leur délai
   d'adhésion repart s'ils s'inscrivent ailleurs. La ville peut la renflouer avant, comme toute entreprise (`InjectCompanyAid`).
4. **Compagnies au départ** : deux, et c'est le **catalogue** qui décide (ajouter, retirer ou renommer une compagnie = une entrée).

5. **Un système à l'américaine** (décidé le 2026-11-07) : les deux régimes du jeu sont la **sécu à la française** (publique, financée par les cotisations,
   choisie dans le panneau Santé) et l'**assurance privée à l'américaine** (les mutuelles/assureurs du bâtiment). L'assureur **paie directement le
   salarié**, sans passer par l'entreprise : c'est déjà le cas de l'indemnité (l'employeur ne paie aucun absent, §5), et l'assurance n'est pas
   obligatoire sauf si la loi l'impose (§7). Le salarié non assuré n'a rien.

**Conséquence comptable** : le jeu n'a pas besoin du plan comptable des mutuelles. Une compagnie est une **entreprise ordinaire du PCG** : la prime
qu'elle reçoit est la vente d'un service (`service_sales`, compte 706 comme les autres services) et l'indemnité qu'elle verse au ménage est une charge
de gestion (compte à choisir ; `658` « Charges diverses de gestion courante » est le candidat du PCG général, **à confirmer** comme `4372`/`4378`
avant la tranche C2). La réserve d'une compagnie est sa trésorerie (512), le plafond des indemnités est cette trésorerie. L'indemnité reçue par le
ménage suit le chemin d'un `household_benefit` (sa contrepartie 437, `4372` pour les mutuelles). Ce choix est volontairement simplifié : les exigences de
solvabilité réelles d'une mutuelle (provisions techniques) ne sont pas reproduites.

6. **Compte de la charge « indemnité versée »** : `658` « Charges diverses de gestion courante », **retenu provisoirement** (2026-11-07). Rien n'empêche de le
   changer plus tard, lors de l'audit comptable du jeu : c'est une seule entrée de `PcgJournalCatalog`.
7. **Prime impayée = couverture perdue** : un ménage qui ne peut pas payer sa prime perd le bénéfice de sa mutuelle (c'est un risque, comme aux États-Unis).
   Règle : l'affiliation se lit du journal (§5), donc un mois sans prime payée n'est pas un mois affilié. Il ne reçoit aucune indemnité pour ce mois,
   et en se réinscrivant (chez la même compagnie ou une autre) son **délai d'adhésion repart de zéro**. Aucun état « suspendu » n'est stocké. Le panneau
   de la maison doit dire pourquoi il n'est pas couvert (prime impayée), jamais seulement « non couvert ».

**Aucun point ouvert bloquant** : la tranche C1 ne dépend d'aucun compte.

## 10. Tests (peu, essentiels)

- Une compétence a un seul fournisseur (garde existante) ; `assurance` n'est accordée qu'en `merchants` tier 2.
- Les indemnités d'un mois ne dépassent jamais la réserve, et la réserve ne descend pas sous zéro (non-régression de la solvabilité).
- Un ménage sans prime payée, ou avant le délai d'adhésion, ne reçoit rien.
- Les écritures équilibrent leurs jambes ; la somme des réserves et des prestations égale primes reçues moins prestations versées (comme
  `socialFundsMonths.regression.test.js`).
- La loi d'obligation est refusée, avec sa raison, quand le bâtiment n'est pas fonctionnel.
