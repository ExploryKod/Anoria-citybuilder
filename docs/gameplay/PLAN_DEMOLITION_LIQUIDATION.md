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
  Aujourd'hui elle annonce : les habitants qui partent, les ouvriers qui perdent leur poste, les bâtiments qui tombent avec lui (entrepôt), les dettes qui lui sont dues
  (abandonnées, sans poursuite) et celles qu'il doit lui-même (qui resteront impayées, tant que la tranche 2 n'existe pas). « Aucune conséquence » ne dit que ce qui est vérifié :
  l'emploi, la population et les dettes (la caisse et le stock viendront avec les tranches suivantes). « Annuler » épargne toute la sélection : le joueur peut redessiner son
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

## Point ouvert : les flux du mois d'un bâtiment démoli

Un bâtiment qui disparaît en cours de mois a pu vendre un service ou échanger des biens pendant ce mois. Au règlement suivant, ces flux désignent un vendeur ou un acheteur
introuvable, et **tout le mois est annulé une fois** (observé au jour 150 : `building … sold a service but is not in the hamlet`). Ce n'est pas persistant (le mois d'après passe),
mais un mois de salaires est perdu. À décider : ne pas facturer un service dont le fournisseur n'existe plus, et écrire les échanges de biens avec lui sous le nom que donne
sa ligne de construction (comme `getBuildingTypes` le fait déjà pour le classement des producteurs).

## À faire (tranches suivantes)

Chacune ajoute des conséquences que le pop-up listera aussi (avec les mêmes fonctions d'aperçu et d'écriture).

2. **Les dettes que le bâtiment démoli doit lui-même** : payées par rang avec sa caisse (`payByRank`), puis le reste est abandonné ; les salaires non couverts sont
   avancés par le fonds de garantie de la ville ; les cotisations et impôts non payés sont une perte pour la ville ; un loyer non payé, une perte pour la SCI.
   Nouveaux types : abandon chez le débiteur (421/431/444/401 contre 7718), créance irrécouvrable chez le créancier (654), avance de la ville.
   À vérifier : le rattachement des lignes de la ville au livret (`CityLedgerLineMappingPolicy`), qui lève une erreur pour un compte sans ligne.
3. **Le stock** vendu à un taux de liquidation (`LIQUIDATION_RECOVERY_RATE`, au catalogue), le produit dans la caisse de l'entreprise ; le stock soldé par la variation de stock.
4. **Le solde** : la caisse restante revient à la ville (retour du capital de fondation, 261) ou la ville constate sa perte ; une écriture solde les comptes de l'entreprise
   (le grand livre et le bilan restent lisibles en archive).
5. **Les ouvriers et les habitants** : le pop-up annonce les ouvriers licenciés et les habitants qui partent (système de départs existant).
6. Les effets sur la **coopérative d'une maison** : seule son entreprise est liquidée.

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

Le prefab `anoria-tour-144` a été exporté dans l'état gelé (14 mois sans règlement, et la dette orpheline du château d'eau envers la maison démolie). Une sauvegarde
ne se répare pas au chargement (règle : pas de migration) : il faut **rejouer et ré-exporter** avec « Tout télécharger ».
