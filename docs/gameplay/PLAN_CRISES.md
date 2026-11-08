# Plan — les grandes crises, avec les mécanismes du jeu

Écrit le 2026-11-08 à partir des six liens du joueur. Rien n'est construit.

## Ce que disent les sources, et leurs limites

- **Banque de France, 1929** : krach (24 et 29 octobre 1929), achats d'actions à crédit jusqu'à 90 %, ruées bancaires (novembre 1930), Kreditanstalt (11 mai 1931) puis Danat, sortie de la livre de l'or, protectionnisme.
  Chiffres : production mondiale −35 % (1929-1932), exportations mondiales en valeur −72 %, production industrielle américaine −30 %, près de 9 000 banques fermées. *La page ne détaille pas les réponses.*
- **Wikipédia et Misterprepa, 1873-1896** : spéculation ferroviaire et crédit hypothécaire, krach de Vienne (9 mai 1873) puis de New York (septembre 1873), défiance interbancaire, chute des prix agricoles (blé américain), puis tarifs
  (Bismarck 1879, Méline, McKinley 49 % en 1890), cartels et trusts, expansion coloniale. Une « grande déflation » plus qu'un effondrement : la production continue de croître. *Misterprepa traite 1873, pas 1929.*
- **Futura Sciences, ancien régime** : mauvaise récolte (petit âge glaciaire), prix du blé ×3 en 1693, les ménages ne dépensent plus qu'en grain, ateliers fermés, chômage, recettes de l'État qui baissent, interdiction d'exporter (1692), greniers municipaux et prix du pain contrôlé, errance,
  épidémies, ≈ 2 millions de morts de trop en 1693-1694 (≈ 10 % de la population), reprise des naissances dès les années suivantes.
- **eco3min, zone euro 2010** : lue sous l'angle de la pénurie de dollars (pas de récit de l'austérité ni de la troïka). Écarts de rendement avec le Bund : Italie 170 → 518 points de base (2011), Espagne 555 (2012), Grèce au-delà de 2 900 ; boucle banques-État ; pas de dévaluation possible ;
  réponses : prêts de la BCE à trois ans, « whatever it takes », décote imposée au privé sur la dette grecque (mars 2012).
- **OFCE (Persée)** : seul un compte-rendu de livre a pu être lu. Sa thèse : on sort d'une crise longue par un *alliage* de facteurs endogènes et de changements institutionnels ; « la répétition n'est pas la figure dominante ». *Aucune phase de Kondratieff, aucun chiffre.*
- **Manquent** : les pays en développement et l'Argentine (seul Barings 1890, lié à l'Argentine, est cité). Il faut d'autres sources.

## Le squelette commun

1. **L'essor** : crédit qui s'étend, spéculation (rail, terrains, actions), euphorie.
2. **Le déclencheur**, un choc venu de dehors : une récolte, un coût (le charbon en 1871), un reflux de capitaux, un krach, la révélation d'une dette.
3. **La transmission** : des banques qui tombent, la défiance entre banques, la pénurie de liquidités (Vienne 1873, Kreditanstalt 1931, dollar 2011), le commerce qui se contracte.
4. **L'amplification** : l'effet de levier et les ventes forcées, la déflation sur des dettes fixes, la fermeture des marchés, le boucle banques-État.
5. **La réponse et la sortie** : le prêteur en dernier ressort, les tarifs, les cartels, la régulation, les colonies ; une sortie *institutionnelle*, jamais la simple répétition.

## Ce que le jeu a déjà, et ce qui manque

Déjà là : banque, banque centrale (facultative), réserve obligatoire, garanties, ratio de fonds propres, garantie des dépôts plafonnée, arriérés de l'État, plafond d'endettement, prêteurs extérieurs, dons, famine et départs, douanes et partenaires commerciaux.

À ajouter, par ordre de rendement :
1. **Un moteur de scénarios** : un catalogue déclaratif (phases, déclencheurs, chocs sur des leviers qui existent, régime de règles, issue). Sans lui, rien d'autre ne sert.
2. **Un régime de règles par époque** (les données, pas du code) : règles du commerce du grain (interdiction d'exporter, greniers, prix du pain), niveau des tarifs, banque centrale permise ou non, étalon or ou monnaie commune. Ancien régime (mercantiliste), libéralisme, protectionnisme, monnaie commune.
3. **Un maillage du commerce extérieur vivant** : chaque ville partenaire a sa propre santé (essor, crise) qui change sa demande, ses prêts et ses prix ; c'est le canal de contagion (Kreditanstalt, retrait des capitaux).
4. **Des prix qui réagissent à la rareté** (le grain), pour la crise de subsistance.
5. **La confiance** : des déposants qui retirent quand la banque faiblit (la ruée), des prêteurs qui s'écartent quand la dette monte (prime de risque sur les prêts de la ville au lieu du seul plafond).
6. **Des conditions aux sauvetages** (austérité contre prêt) et la restructuration d'une dette.
7. **Plus tard** : plusieurs banques, prix des terrains et des actions, monnaies et changes (Argentine).

## Le cycle long

Une suite d'**époques**, chacune avec son régime et ses déblocages (innovations : de nouveaux bâtiments et biens). Une phase d'essor, une phase de dépression qui se termine par une crise ; la sortie n'est pas automatique : elle exige un choix institutionnel du joueur
(tarifs, cartels, régulation, nouveaux marchés), et ouvre l'époque suivante. Aucune source lue ne donne de durées ni de phases : les chiffres sont à inventer et à régler en jouant.

## Ordre proposé

1. Le moteur de scénarios + les régimes + les prix du grain : la **crise de subsistance** (1693) est jouable avec presque rien de plus.
2. La confiance et la ruée + le maillage extérieur : la **panique de 1873** (et une version simple de 1929).
3. La prime de risque et les conditions : la **crise de la zone euro**.
4. L'Argentine et les pays en développement, une fois les sources trouvées et les monnaies distinctes.

## Bilan avant la crise de subsistance (ancien régime), 2026-11-08

Lu dans le code. ✅ existe, 🟡 existe en partie, ❌ manque. La chaîne est celle de Futura Sciences (1693).

| Maillon de la chaîne | Ce qu'il faut | État |
|---|---|---|
| Mauvaise récolte | un rendement qui varie selon l'année (le climat) | ❌ le rendement d'une ferme est une constante (`FARM_ANNUAL_YIELD`) ; les seuls aléas sont l'ouragan et l'inondation, qui coûtent de l'argent |
| Le grain devient rare, son prix flambe | un prix qui monte avec la rareté | ❌ le prix est coût + marge d'étage (`PriceBook`), et baisse avec la fraîcheur ; rien ne le fait monter quand le stock manque |
| Les ménages ne dépensent plus qu'en nourriture | une hiérarchie des besoins | 🟡 une maison n'achète que ce qu'elle peut payer, et les citoyens mangent d'abord ; aucune règle ne fait reculer les biens manufacturés avant le pain |
| Ateliers sans clients, chômage | des entreprises qui perdent leur clientèle, ferment, licencient | 🟡 une entreprise sans recettes s'endette (impayés, délai de grâce) ; seules les assurances sont liquidées pour insolvabilité |
| Les recettes de l'État baissent | impôts qui suivent l'activité, arriérés | ✅ (plancher du Trésor, arriérés, plafond d'endettement) |
| Réponse : prix du pain contrôlé | un levier de prix | ❌ |
| Réponse : interdiction d'exporter le grain | un levier du commerce | ❌ deux villes partenaires *achètent* du blé (×1,1 et ×1,2 du prix de base) : le jeu l'exporte, sans pouvoir l'interdire ; une relation ne cesse que pour ses raisons propres |
| Réponse : greniers municipaux | un stock public avec une règle (garder, distribuer, vendre) | 🟡 les entrepôts et leurs durées de vie existent ; aucune règle de distribution ou de vente au pic |
| Réponse : importer du grain | des villes qui en vendent | ❌ aucune ville partenaire n'a de blé à l'offre |
| Réponse : secours | charité, aide alimentaire | 🟡 allocation chômage ✅ ; aide alimentaire ❌ |
| La faim | disette (pas d'argent) et pénurie (rien à acheter) | ✅ distingués (`HungerCauseCatalog`), risque de faim annoncé, la faim retire des points de santé |
| La surmortalité | une mortalité de famine réglée sur ≈ 10 % | 🟡 existe mais marquée « léger, POC », et seulement dans le mode qui a une défaite |
| Les errants, les départs | un départ causé par la faim | ❌ la seule cause de départ est le loyer impayé (`DepartureCauseCatalog`) |
| Les épidémies | une maladie qui profite de la faim | 🟡 santé et contagion existent (la faim abaisse la santé) ; pas d'événement d'épidémie |
| La reprise des naissances | un rebond démographique | 🟡 la croissance existe ; son rebond après la crise n'est pas vérifié |
| Le récit et les repères | dépêches, indice du prix du grain | 🟡 dépêches ✅, compteurs de faim ✅ ; indice des prix ❌ |
| La mission qui la porte | une définition de mission (départ, script, objectifs, victoire, défaite) | 🟡 le mode `mission` n'est qu'un indicateur, rien ne le lit ; les objectifs comptables existent (`ObjectiveCatalog`) |

À ajouter pour que la mission 1693 tienne : (1) la définition de mission et le moteur de scénario ; (2) le rendement par année (le choc climatique) ; (3) le prix qui suit la rareté ; (4) les leviers de régime : interdiction d'exporter, prix du pain, règle du grenier public, grain à l'import ;
(5) la cause de départ « faim », la mortalité de famine réglée et une épidémie ; (6) l'indice des prix. Les points 2 et 5 se règlent dans des catalogues existants ; 3 et 4 demandent du code nouveau.
