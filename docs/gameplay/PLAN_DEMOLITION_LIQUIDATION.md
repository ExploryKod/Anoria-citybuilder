# Plan : démolir un bâtiment, c'est le liquider (2026-10-25)

## Pourquoi

En analysant le prefab, on a trouvé que le règlement mensuel s'était **gelé pendant 14 mois** après la démolition d'une maison : une entreprise
(le château d'eau) lui devait 22,68 € de salaires ; chaque début de mois elle voulait payer cette vieille dette en premier, ne retrouvait plus le
créancier (`nameOf`), et le lot entier du mois était annulé. `GameLoop` avalait l'exception : le joueur ne voyait rien, mais plus aucun salaire,
allocation ni loyer n'était versé, les ménages sont tombés à découvert et n'ont plus pu payer la nourriture.

La cause n'était pas qu'un bug technique : **le jeu n'avait aucune règle sur la comptabilité d'un bâtiment démoli**. `BulldozeBuildingAtTile`
effaçait seulement l'emplacement et la ligne de base ; aucune écriture n'était passée.

## Décisions (du joueur, 2026-10-25)

- **Démolir = liquider** : les comptes du bâtiment sont soldés comme dans une liquidation (la séquence de `PLAN_BANKRUPTCY_PAYABLES.md`, étape 4b),
  déclenchée par la démolition du joueur et non par trois mois d'impayés.
- **Un pop-up prévient** des conséquences pour l'économie et la comptabilité avant la démolition.
- **La maison du maire ne peut pas être démolie** (elle porte la SCI qui possède tous les bâtiments). Plus tard, un bouton **« déplacer »**
  (comme dans Anno 117) permettra de la changer de place sans la détruire.
- **Les ménages : dettes effacées sans poursuite.** Un ménage n'est pas une entité du plan comptable ; son compte personnel n'est pas touché, et ce qu'on
  lui devait est abandonné (aucune poursuite, comme pour les départs et les loyers des maisons vides).

## Fait (tranche 1)

- `LiquidateDemolishedBuilding` (service du contexte comptable) : **les dettes dues au bâtiment démoli sont abandonnées** par une opération diverse
  `od_abandoned_wage` (débit 421, crédit 7718 « produits exceptionnels ») sur le compte du débiteur. `DebtPolicy` la lit comme un règlement sans argent :
  la dette se ferme dans le journal. Un type de dette sans abandon déclaré (`PayableCatalog.abandonment`) fait **refuser** la liquidation, en la nommant.
- `preview` et `execute` lisent les dettes par la même fonction : ce que le pop-up annonce est exactement ce qui est écrit.
- `BulldozeBuildingAtTile` ferme les comptes **avant** d'effacer l'emplacement : si la comptabilité échoue, le bâtiment reste et l'erreur est montrée
  (toast d'erreur + trace taguée `[Construction]`). Les routes et la nature, sans compte, sont écartées (un grand effacement ne relit pas le journal pour chacune).
- **Maison du maire** : fait de catalogue `undemolishable: true` (`buildingEconomy.js`), lu par `isUndemolishable` ; la commande refuse, la gomme saute le
  bâtiment avec un message (`showDemolitionRefusedNotification`).
- **Confirmation avant toute démolition** (`confirmDemolition`, remplace l'ancienne question propre aux entrepôts) : **pour tous les bâtiments sauf les routes et
  la nature**, une seule question pour toute la sélection (une gomme en carré en pose une seule), qui dit pour chaque bâtiment ce qu'il entraîne **ou qu'il n'entraîne rien**.
  Elle annonce : les habitants qui partent, les ouvriers qui perdent leur poste, les bâtiments qui tombent avec lui (entrepôt), les dettes qui lui sont dues (abandonnées, sans
  poursuite) et toute la liquidation de ses comptes (voir plus bas : stock vendu, dettes payées avec sa caisse, salaires avancés par la ville, pertes des créanciers, caisse rendue à la
  ville, capital perdu). « Aucune conséquence » dit : pour l'emploi, la population et les comptes. « Annuler » épargne toute la sélection : le joueur peut redessiner son
  carré. Les noms et libellés viennent du catalogue, les montants du format monétaire. Perdu au passage : refuser un entrepôt seul au milieu d'une sélection.
- `GetProducerRevenues` : un vendeur ou un acheteur démoli est lu par le type que nomme sa ligne de construction, au lieu de lever une erreur dans l'écran Finances.
- `GameLoop` trace l'échec d'un jour (`[GameLoop] A day failed…`, tag relayé au journal de dev) puis relance l'erreur comme avant.
- Test de non-régression : `tests/contexts/accounting/demolitionLiquidation.regression.test.js` (l'entreprise qui devait des salaires à la maison démolie ;
  son mois suivant se règle ; un type sans abandon est refusé ; la maison du maire ne se démolit pas ; les comptes se ferment avant que le bâtiment parte).

- **Tous les chemins par lesquels un bâtiment quitte la carte** passent par la commande `RemoveBuilding` (contexte Parcels), qui ferme maintenant ses comptes juste avant de supprimer
  sa ligne : la gomme, mais aussi une **catastrophe aléatoire** (`RandomEventsSimulationService.triggerEvent`, qui détruit une maison au hasard) et un entrepôt qui entraîne ses
  dépendants. Découvert le 2026-10-25 grâce à la trace de `GameLoop` : une maison de 12 habitants à qui l'on devait 82,94 € a disparu hors du chemin du joueur, et le règlement
  se figeait de nouveau chaque mois (jour 175 et suivants). La gomme garde sa fermeture en amont (stricte : si les comptes ne se ferment pas, le bâtiment reste) ; la seconde passe
  ne trouve plus de dette et n'écrit rien. Test : `placeRemove.behavior.test.js`.

## Les flux du mois d'un bâtiment démoli (fait)

Un bâtiment qui disparaît en cours de mois a pu vendre un service ou échanger des biens pendant ce mois. Au règlement suivant, ces flux désignaient un vendeur ou un acheteur
introuvable, et **tout le mois était annulé une fois** (observé au jour 150 : `building … sold a service but is not in the hamlet`) : un mois de salaires perdu.

Règle retenue, appliquée à l'entrée de `SettleProducerCharges` : **un bâtiment qui n'existe plus n'a plus de compte sur lequel écrire.** Ce qu'il a vendu, acheté ou servi pendant le
mois n'est pas réglé — un échange de biens avec lui n'est écrit d'aucun côté, un service qu'il fournissait ou recevait n'est pas facturé, sa perte par avarie n'est pas dite. Le reste
du mois, et les charges de l'autre partie, se règlent comme d'habitude ; les mouvements restent dans la traçabilité de l'approvisionnement. Test :
`demolitionLiquidation.regression.test.js`. Conséquence assumée : une maison qui utilisait le service d'un bâtiment démoli en cours de mois ne le paie pas ce mois-là.

## Fait (tranches 2 à 6) : la liquidation complète d'un compte

`LiquidateDemolishedBuilding` établit **un seul plan** par compte (`LiquidationPlanPolicy.planLiquidation`, pur, en centimes) que `preview` annonce et `execute` écrit, dans un
lot atomique (`inJournalBatch`). Un bâtiment est liquidé une fois : ses lignes portent la clé `liquidation:<hameau>:<bâtiment>:` et un second appel ne fait rien (la gomme ferme
les comptes en amont, le point de passage commun `RemoveBuilding` les referme ensuite). Les comptes liquidés sont ceux d'une entreprise, ou l'entreprise d'une maison (sa coopérative) ;
le compte personnel d'un ménage et celui d'un bâtiment public ne sont pas touchés.

Dans l'ordre, pour chaque compte :
1. **Le stock** sort des livres par la variation de stock (`od_stock_down_*`, clé propre à la liquidation) et est vendu à `LIQUIDATION_RECOVERY_RATE` (0,5, au catalogue,
   premier réglage) de sa valeur au coût : `liquidation_stock_sale` (707) dans la caisse.
2. **Les créanciers sont payés par rang** avec la caisse et ce produit (`planCompanyPayments` : salaires, puis ville, puis propriétaire, au prorata dans un même rang), avec
   les mêmes écritures que le règlement mensuel (module partagé `DebtLines.js`, extrait de `SettleProducerCharges`), à clé distincte.
3. **Ce qui reste d'une dette est abandonné** : le débiteur est libéré (`od_abandoned_*`, 7718) et le créancier supporte la perte. Les **salaires** sont avancés par la ville
   (`wage_guarantee`, 65741, que le livret range déjà sous les aides au logement) et reçus par la maison des ouvriers ; les cotisations et l'impôt sont une perte pour la ville
   (`od_bad_debt_*`, 6541) ; un loyer, une perte pour la SCI (654).
4. **Le solde de la caisse revient à la ville, au plus le capital qu'elle y avait mis** (`liquidation_surplus_paid` / `_received`, 101 contre 261 : le livret y voit un
   remboursement d'investissement, comme une construction remboursée) ; **le reste du capital est perdu** (`od_holding_written_off`, 675). Les bénéfices accumulés au-delà du
   capital restent dans le compte de l'entreprise liquidée (pas de dividendes avant le futur système de propriétaire).
5. Les dettes dues AU bâtiment sont abandonnées par leurs débiteurs (tranche 1).

Le pop-up annonce tout cela. Une maison ou un bâtiment disparu par une catastrophe passe par le même chemin (`RemoveBuilding`). Le règlement mensuel écarte, en plus des flux d'un bâtiment
disparu, les ouvriers qu'une entreprise tirait encore d'une maison détruite après l'étape d'emploi du jour.

Vérifié sur le vrai prefab (`anoria-tour-107`) avec le câblage réel : une caserne endettée et une maison créancière liquidées (9 lignes équilibrées, aucune dette ouverte, seconde passe
sans écriture), puis le mois suivant réglé.

## Reste

- **La clôture formelle des comptes** (une écriture qui solderait toutes les soldes de l'entreprise) n'est pas écrite : le compte reste lisible en archive, le grand livre et la
  balance le lisent comme avant. Utile seulement si l'on veut une balance à zéro pour un compte disparu.
- **Les bénéfices au-delà du capital** ne reviennent pas à la ville (voir 4) : à reprendre avec le système de dividendes.
- Une **purge** d'années qui repliait la caisse ou le capital d'un compte liquidé : le capital de la ville se lit sur les lignes `company_capital_received` ; un compte dont le capital
  ne serait que dans la clôture d'une année purgée aurait un capital de 0 pour la liquidation (rien n'est rendu ni perdu). À traiter avec la purge.

## Hors périmètre

- **Le bouton « déplacer »** (la maison du maire d'abord).

## La gomme (fait, demande à part)

- **Survol** : la gomme éclaire en rouge l'emprise **entière** du bâtiment pointé avant tout clic.
- **Carré glissé** : en rouge, l'emprise entière de chaque bâtiment touché (un bâtiment part en entier, pas seulement par la partie sous le carré) ; en ambre, les cases vides du
  carré tracé. Un bâtiment que le catalogue interdit de démolir n'est pas teinté. `roadPaintPreview` gagne une couche `area` (ambre).
- **Plafond** : le carré ne dépasse pas `ERASE_SQUARE_MAX_SIDE` (5) cases de côté ; l'aperçu cesse de grandir à la limite.
- La confirmation (`confirmDemolition`) reste la dernière garde : « Annuler » épargne toute la sélection.
- **Le déclencheur « trois mois d'impayés »** de l'étape 4b réutilisera les écritures de la liquidation.

## Conséquence pour le prefab

Le prefab du tour 144 avait été exporté dans l'état gelé (14 mois sans règlement, et la dette orpheline du château d'eau envers la maison démolie). Une sauvegarde
ne se répare pas au chargement (règle : pas de migration) : il a été **rejoué et ré-exporté** avec « Tout télécharger » après les correctifs. Le prefab actuel est
`anoria-tour-107` : 107 jours, 21 fins de mois toutes réglées, aucune dette orpheline. Sa trésorerie est de −3 796,85 € (la ville s'endette régulièrement).
