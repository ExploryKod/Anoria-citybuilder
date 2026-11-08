# Plan — les relations commerciales : personnalités, mémoire, deux barres, contrats, traités, embargos

Écrit le 2026-11-08 à partir des demandes du joueur. **Rien n'est construit.** Le périmètre est économique : la politique (étrangère, intérieure) viendra ensuite, et ce plan lui laisse des prises. Le but premier est la **visibilité** : le joueur doit voir, ville par ville et bien par bien, ce que le commerce international lui apporte, ce qu'il lui coûte, et pourquoi.

## Ce qui existe, et ce qui ne va pas

- Le score de **satisfaction** va de −100 à +100, part de 0, et bouge à chaque mois de commande : de +1 à +3 si une vente ou un achat a eu lieu, de −2 à −6 sinon (`TradeSatisfactionPolicy.js`, un seul facteur : `sales`). Il est **unique par partenaire**, alors que l'échange se joue **bien par bien**.
- À `breakThreshold` (−40 à −80), la ville coupe **toute** la relation. Rien ne la rouvre : `checkAndOpenNewRelations` ne recrée que les relations absentes.
- `saleBias` vaut toujours 0 (`createTradeContext.js`) : la cote ne change **ni les prix ni les quantités**. La barre est un compte à rebours sans avantage.
- `contractEndMonth` vaut toujours `null` : la règle « fin de contrat, renouvellement » ne s'applique jamais.
- Les arrêts par bien (`unprofitable`, `export_*`, entrepôt plein…) existent déjà dans `TradeCeasePolicy.js`, avec leurs mots dans le catalogue ; les **douanes** (par bien et par sens, pour l'autorité `anoria`, **pas par partenaire**) et l'indice de prix du monde (`WORLD_MARKET`) aussi.

Défaut de fond : un seul nombre mélange la **mémoire d'une relation** et le **climat des affaires**, il juge le tout sur le volume, et il ne dit rien du bien ni de la cause.

## Principes

1. **La visibilité d'abord** : rien n'agit sans que le joueur puisse voir *pourquoi*, avant (aperçu) et après (cause).
2. **Le catalogue décide** : la personnalité d'un partenaire, ses sensibilités, ses événements, les gestes possibles. Du code qui lit des données, jamais un partenaire écrit à la main dans le code.
3. **Une mémoire, pas un compteur** : la relation se **lit** d'un journal d'événements (comme la trésorerie se lit des écritures), elle ne se stocke pas.
4. **Simple et prêt à s'étendre** : peu d'événements et peu de gestes au départ, mais chaque nouveau est une entrée de catalogue.

## Le partenaire a une personnalité (le catalogue)

Chaque ville du catalogue déclare un **caractère**, qui règle ses réactions : un partenaire n'a pas les mêmes réponses qu'un autre au même acte. Valeurs déclaratives, par exemple :

| Trait | Ce qu'il règle |
|---|---|
| Réaction à l'embargo | encaisse, riposte, ou rompt (et à partir de quand) |
| Sensibilité à l'aide non rendue | patient, ou rancunier |
| Sensibilité aux douanes | tolère, ou les prend pour une mesure hostile (le seuil) |
| Mémoire | à quelle vitesse il oublie (voir plus bas) |
| Goût du risque | accepte un prix serré, ou veut sa marge |
| Reconnaissance | un geste lui plaît beaucoup, ou peu |
| **Libéralisme** | de **protectionniste** à **libéral** : ses propres droits de douane sur ce qu'il achète chez nous, sa façon de les relever, et s'il propose ou refuse un traité de libre-échange (voir plus bas) |

**Ce que le joueur en sait** : un caractère en mots (« fier et rancunier », « marchand patient ») sur la fiche de la ville, qui l'avertit **sans chiffrer les conséquences**. Il apprend le reste en jouant.

## Deux barres, deux natures

| | **Relation** | **Satisfaction commerciale** |
|---|---|---|
| Ce que c'est | la mémoire longue entre deux États | le climat des affaires, aujourd'hui |
| Portée | un partenaire | un partenaire **et un bien** (et un sens : import / export) |
| Rythme | lent ; un événement la marque pour toujours | rapide ; elle suit l'offre et la demande |
| Ce qui la fait bouger | des décisions, des événements, des aides, des gestes, des contrats | les négociants du partenaire, selon des facteurs économiques |
| Peut-elle couper ? | **oui**, par une cause (rupture, embargo) | **jamais** : elle refroidit, et reprend dès que l'offre et la demande reprennent |
| Ce qu'elle donne | l'accès (biens négociables, contrats, traités), la tolérance sur les prix, le risque d'embargo subi | les quantités et les prix du jour que ses négociants acceptent |

### La satisfaction commerciale (pur business)

Elle reflète si les **négociants du partenaire** achètent (ou vendent) le bien. Elle est tenue **par partenaire, bien et sens** ; la barre d'une ville en est le résumé pondéré par les volumes.

| Facteur | Ce qu'il dit |
|---|---|
| Prix | notre prix est-il juste face à l'indice du monde et à ce que le partenaire paie ailleurs ? |
| Disponibilité | nos négociants ont-ils de quoi livrer (stock, entrepôt, négociants) ? |
| Besoin du partenaire | sa demande est-elle encore là, ou saturée ? |
| Fiabilité des commandes | les commandes sont honorées sans échec |
| Contrats | des contrats actifs la **soutiennent** : plus il y en a, mieux elle tient |
| Barrières | douane, limitation en volume : elles renchérissent l'échange |

Effets : le **volume et le prix du jour** que ses négociants acceptent. Au plus froid, les quantités tombent à un plancher et les commandes s'espacent, mais le commerce **ne s'éteint pas** par elle-même : il ne s'arrête que par les raisons déjà déclarées (`unprofitable`, entrepôt plein…), qui se lèvent toutes seules.

### La relation (la mémoire)

La relation est la **somme des événements gardés**, chacun avec son poids, **pondéré par la personnalité** du partenaire et **amorti par le temps** :

```
relation = Σ  poids(événement) × sensibilité(personnalité, genre) × oubli(âge)
```

- **Le journal de la relation** est append-only et **ne se purge jamais** : un événement reste pour toujours. Ce qui baisse, c'est son **poids** : `oubli(âge)` perd une part de son poids par année écoulée (−x par x ans, une pente que fixe la mémoire du partenaire), jusqu'à un **résidu** non nul : le très ancien pèse peu, mais ne disparaît pas.
- Chaque **genre d'événement** est une entrée de catalogue : un poids de départ, sa pente d'oubli, et la sensibilité de chaque personnalité. Genres de départ, peu nombreux :
  - un contrat honoré, un contrat rompu ;
  - une aide reçue non rendue (le prêt d'une ville partenaire de `ExternalLenderCatalog.js`, un don accepté), puis rendue ;
  - un embargo décrété contre lui, un embargo qu'il nous a imposé ;
  - des douanes au-dessus de son seuil de tolérance ;
  - un geste diplomatique (voir plus bas) ;
  - un événement du monde qui le touche.
- La relation est **lue** de ce journal à chaque affichage : comme la trésorerie, jamais stockée. Elle a des **paliers nommés** (hostile, tendue, neutre, cordiale, amie), dont les effets sont déclarés au catalogue : à partir de tel palier, les biens négociables s'ouvrent, les traités deviennent possibles ; en dessous, le risque d'embargo subi monte.
- Seule une **cause** la fait tomber jusqu'à la rupture. Une rupture se **renoue** par un geste, après un délai.

## Les gestes diplomatiques

La ville a des gestes pour **renflouer** une relation (ou l'aggraver) : chacun est une entrée de catalogue (un coût, un effet qui ajoute un événement au journal, un délai avant de le refaire, des conditions). Au départ, peu de gestes :

- **un don** (de l'argent ou de biens) au partenaire ;
- **une aide** (un prêt consenti à sa ville) ;
- **une mission** pour rouvrir une relation rompue ;
- **honorer** : rendre une aide.

Le coût est une **écriture au journal** comme tout mouvement d'argent (jamais un solde modifié à côté). D'autres gestes viendront avec la politique, sans toucher au reste.

## Avec la ville : le contrat (une mission diplomatique)

La ville **propose** un accord à un partenaire, qui l'accepte ou non.

- **Une proposition** : un partenaire, un sens, un bien, une quantité par mois, un prix unitaire, une durée.
- **La réponse** est une règle déclarée au catalogue, avec ses raisons affichées en clair : le prix proposé se compare à un prix de référence (valeur du bien × coefficient de la ville × indice du monde), avec une tolérance qui dépend de la **personnalité** (son goût du risque) et de la **relation**. Refus : « le prix est trop bas pour lui », « il ne cherche pas ce bien », « il n'a pas la quantité », « nos relations sont trop tendues ». Une nouvelle tentative coûte du temps.
- **Un contrat accepté** fixe le prix (à l'abri de l'indice du monde), garantit la quantité, et dure. Il est **honoré** ou **rompu** ; une rupture est un événement lourd de la relation, avec un montant dû, en écriture au journal.
- **La ville élargit l'offre et la demande** : une entrée du catalogue déclare des biens *négociables*, qu'une relation assez bonne ou un contrat honoré **ouvrent**.

Sans contrat, un bien s'échange au **cours** : c'est le marché entre États, et la satisfaction commerciale le dit.

## Le traité de libre-échange

Un engagement entre deux États, plus fort qu'un contrat : des **baisses de douane drastiques**, des deux côtés.

- **Conditions** : une relation au moins « cordiale », un historique, et un partenaire dont la personnalité l'accepte.
- **Engagements** : la ville plafonne ses douanes envers ce partenaire (ou les met à zéro sur une liste de biens) ; le partenaire en fait autant, ce qui améliore le prix et le volume de ses négociants pour ces biens.
- **Durée et sortie** : un terme, un renouvellement. Le **rompre** (relever une douane, décréter un embargo sur un bien couvert) est un événement très lourd de la relation.
- **Conséquence à assumer** : les douanes sont une recette de la ville ; le traité la réduit, et le panneau le **montre** (la recette perdue, l'échange gagné).
- **Prérequis technique** : aujourd'hui une douane est **par bien et par sens**, pas par partenaire. Un traité demande une douane **préférentielle par partenaire**, qui prime sur la douane générale.

## Les droits de douane du partenaire (le libéralisme)

Un partenaire a lui aussi des douanes, sur **ce qu'il achète chez nous**. Elles sont réglées par son **libéralisme** (un trait de la personnalité, du catalogue) :

- **Protectionniste** : des droits élevés (de l'ordre de 15 à 25 %) sur nos exportations, qu'il **relève** quand l'échange le désavantage : si **son solde bilatéral avec nous est en déficit** (nous lui vendons bien plus que nous ne lui achetons) pendant plusieurs mois, il hausse ses droits d'un cran, jusqu'à un plafond. Il ne propose **jamais** de traité, et refuse celui qu'on lui propose, sauf relation très haute. (L'idée vient de la réalité : un partenaire qui relève ses droits parce qu'un commerce lui paraît déséquilibré.)
- **Modéré** : des droits faibles (5 à 10 %), qui bougent peu ; il **accepte** un traité qu'on lui propose, si la relation est assez bonne.
- **Libéral** : des droits quasi nuls (0 à 3 %) ; il **propose lui-même un traité de libre-échange** dès que la relation est cordiale (une dépêche à **deux réponses**, accepter ou refuser, comme les dépêches à choix du jeu).

Effet sur notre commerce : ses négociants paient droits compris, donc **acceptent un prix net plus bas** et **achètent moins** quand ses droits montent. C'est un facteur « barrières » de la **satisfaction commerciale** du bien, et la fiche de la ville affiche **le droit du partenaire** à côté du nôtre. Sa hausse des droits est un événement, **dit par une dépêche** qui en nomme la cause (« il juge nos échanges déséquilibrés ») ; elle est liée à la **balance commerciale** : c'est ce qui rend la balance utile à lire.

## Les leviers de la ville : la politique commerciale

Un seul endroit : la section Commerce du panneau admin. Pour chaque partenaire, bien et sens :

1. **Embargo décrété** : la ville cesse de commercer tel produit (ou tout un sens). Il marque la relation (événement), et coupe l'échange du bien sans toucher à la satisfaction des autres.
2. **Limitation en volume** (imposée par la loi) : un plafond par mois, à l'export ou à l'import. Si un contrat promet plus, c'est la ville qui rompt.
3. **Douanes** : ce qui existe, relié aux deux barres : elles renchérissent l'échange et, au-dessus du seuil de tolérance du partenaire, elles marquent la relation.
4. **Embargo subi** : le partenaire décrète lui-même un embargo sur un bien, **même sans que la ville ait rien fait**. Un catalogue d'événements de politique du partenaire (probabilité, durée, biens visés, selon sa **personnalité**) le déclenche ; une relation tendue, des douanes élevées ou nos propres embargos **augmentent le risque** sans être nécessaires. Il est annoncé par une dépêche, et se lève au terme de sa durée.

**Un aperçu avant de valider** : chaque levier montre, avant qu'on l'applique, ce qu'il va faire (« cette douane de 20 % sur le bois : recette de l'ordre de X € par an, exports estimés en baisse de Y %, relation : agacement léger chez ce partenaire »). L'aperçu est calculé **avec les mêmes règles** que le jeu, jamais par un second calcul.

## La visibilité (le but premier)

### Par ville et par bien

Tout se lit à deux niveaux : la **ville** (la relation) et le **bien échangé avec elle** (la satisfaction commerciale, les contrats, les barrières, les dépêches). Un même bien a des barres différentes d'une ville à l'autre.

- **Le panneau admin** (section Commerce) : une **carte par ville** — son nom, son caractère en mots, la relation (palier, tendance), un résumé de la satisfaction commerciale, et des pastilles : contrat, embargo, traité, limitation. Un clic ouvre la **fiche de la relation** : bien moins lourd que de charger la carte.
- **La fiche d'une ville** : la barre de relation et son histogramme de facteurs ; la **chronologie** du journal de la relation (chaque événement, son poids d'origine et son poids d'aujourd'hui, pour voir l'oubli) ; le **tableau des biens** avec, pour chacun : le sens, la satisfaction commerciale et sa tendance, la raison du moment, le prix pratiqué, les barrières, le contrat qui le couvre ; les leviers et les gestes disponibles.
- **Les « ? »** (`HelpCatalog.js`) sur chaque barre, chaque palier, chaque facteur.
- **La balance commerciale** (onglet de l'Économie, et la ligne « solde » de chaque fiche de ville) : voir la section qui suit.
- **Chaque événement est dit** par une dépêche, au bon ton, qui nomme sa cause.

### La balance commerciale (comme dans le monde réel)

Une vue de **notre balance commerciale**, avec un **commentaire** qui dit l'état et ses conséquences. Tout est **lu du journal** (les lignes de commerce sont déjà typées : `abroad_sale_<bien>` les ventes à l'étranger, `import_<bien>` les achats, `freight_` le transport, les droits de douane, et les conversions de devises `od_foreign_reserves_in/out`) : aucun second compteur.

**La vue**, du plus simple au plus fin :

- **Le solde** : exportations moins importations, sur le mois, l'année et depuis le début, avec le **taux de couverture** (exportations ÷ importations).
- **Du solde des biens au solde courant**, comme dans les comptes d'un pays : le solde des biens, plus le transport payé à l'étranger, plus les revenus (les intérêts payés à l'étranger, déjà calculés pour le PNB), égale le **solde courant**.
- **Une courbe** sur douze mois (barres au-dessus de zéro : excédent ; en dessous : déficit), pour voir la tendance.
- **Ce qui l'explique** : les biens et les villes qui pèsent le plus, de chaque côté (les trois premiers). Même vue, par ville, sur la fiche : le solde **bilatéral**, bien par bien.
- **La dépendance** : la part d'un seul partenaire ou d'un seul bien dans nos exportations et nos importations (le risque d'un embargo), et la part de l'alimentation importée.
- **Les termes de l'échange** : nos prix d'export face à nos prix d'import, rapportés à l'indice du monde.
- **La recette des douanes** à part : c'est une recette de la ville, pas un solde extérieur.

**Le commentaire** est un texte du catalogue, choisi selon l'**état** (déficit, équilibre, excédent ; en aggravation, stable, en amélioration) et rempli des chiffres du moment, comme les « ? » (`HelpCatalog.js` : des textes écrits d'avance, des états, des chiffres, jamais une phrase générée). Il dit, en paragraphes courts :

1. **l'état** (« la ville achète plus qu'elle ne vend : −420 € ce mois, couverture de 71 % ») ;
2. **les causes** (les biens et les villes qui pèsent ; une douane, un embargo, un prix qui a changé) ;
3. **les conséquences, qui sont déjà celles du jeu** :
   - *un déficit* fait **sortir de l'argent** de l'économie : la banque centrale **cède des devises** (ses réserves de change baissent) ; il se finance par des **prêts de villes partenaires**, dont les intérêts quittent l'économie (le PNB passe sous le PIB), jusqu'au **plafond d'endettement** ;
   - *un excédent* fait **entrer de l'argent**, augmente les réserves de change, et rend l'économie dépendante de ses clients (un embargo fait mal) ;
   - *une forte dépendance* à un partenaire ou à un bien expose à un embargo subi ;
4. **ce qu'on peut faire** : les leviers qui existent (douanes, limitation, contrat, traité), nommés avec leur **aperçu**.

Un état sans conséquence importante est dit en une phrase : pas de commentaire pour le commentaire.

### La carte

Son sort est à voir à part. Une règle dès maintenant : elle **lit les mêmes chiffres** que la fiche (une seule lecture, `describeTradeRelation`), pour qu'elles ne se contredisent jamais.

## Les données et le code, par morceaux livrables

À chaque étape, le jeu reste jouable. Le catalogue d'abord, le code ensuite.

1. **La lecture unique** : une requête `describeTradeRelation(cityId)` (la relation, ses facteurs, ses biens), les **cartes par ville** et la **fiche** dans le panneau admin. Elle lit d'abord l'existant : on voit enfin ce qui se passe.
2. **La balance commerciale** et son **commentaire** : elle ne dépend que du journal, tel qu'il est déjà écrit, et donne tout de suite de la visibilité sur les conséquences (devises, endettement, dépendance). C'est le morceau le moins risqué et le plus parlant : il ne change aucune règle.
3. **La satisfaction commerciale par bien et par sens**, ses facteurs, son histogramme, son « ? », ses effets ; plus de rupture par refroidissement. *Les tests du commerce sont à adapter.*
4. **La personnalité** (catalogue, mot sur la fiche) et **la mémoire** : le journal de la relation, les genres d'événements, l'oubli, les paliers et leurs effets, la rupture par une cause, le renouement.
5. **Les gestes** et le coût en écriture au journal.
6. **Les leviers** : embargo décrété, limitation en volume, douane préférentielle par partenaire, aperçu avant de valider.
7. **L'embargo subi** et le catalogue d'événements de politique du partenaire (le générateur aléatoire injectable existe déjà).
8. **Les contrats**, puis **le traité de libre-échange**.
9. **L'alignement de la carte.**
10. **Le marché vivant** : la santé propre de chaque partenaire (voir `PLAN_CRISES.md`).

Le prefab de départ ne stocke pas de relation commerciale à adapter ; à confirmer en lisant son JSON avant l'étape 1. Pour libérer `'state'`, `by: 'city'` (qui désigne aujourd'hui le partenaire) devient `by: 'partner'`.

## Décisions

### Prises

- **La balance** : montrée **par mois** (le mois choisi) et **par an**, calculée **à la consultation seulement** (pas d'appel de fond). Les mois révolus ne changent plus : leur résultat est gardé en mémoire ; seul le mois en cours est relu. Si la lecture par mois pèse trop, on passe au **trimestre**. Le transport et les intérêts entrent dans un **solde courant**.
- **Les alertes de dépendance** : au choix de l'assistant (voir ci-dessous).

### Prises (le joueur a dit « ok, on prend tes recommandations », avec un trait de plus : le libéralisme)

Chacune est une valeur de départ, à régler en jouant, écrite au **catalogue**.

1. **Les paliers** (échelle −100 à +100 pour les deux barres).
   - *Relation* : hostile (≤ −60), tendue (−60 à −20), neutre (−20 à +20), cordiale (+20 à +60), amie (≥ +60).
   - *Satisfaction commerciale* : glaciale (≤ −50), fraîche (−50 à −15), normale (−15 à +15), chaude (+15 à +50), florissante (≥ +50).
2. **L'oubli** : une perte **linéaire par an** d'une part du poids d'origine, jusqu'à un **résidu**, fixée par la **mémoire du partenaire** : oublieux −40 % par an (résidu 10 %), moyen −25 % par an (résidu 15 %), tenace −12 % par an (résidu 25 %). Un événement pèse donc encore près d'un quart la quatrième année, puis il ne reste que son résidu, pour toujours.
3. **Les traits de personnalité** (sept, chacun avec trois niveaux déclarés) :
   - réaction à l'embargo : *encaisse*, *riposte*, *rompt* ;
   - sensibilité à l'aide non rendue : × 0,5, × 1, × 2 ;
   - sensibilité aux douanes (seuil de tolérance) : 35 %, 20 %, 10 % ;
   - mémoire : voir 2 ;
   - goût du risque (écart de prix qu'il accepte dans un contrat) : 20 %, 10 %, 5 % ;
   - reconnaissance (poids d'un geste) : × 0,5, × 1, × 1,5 ;
   - **libéralisme** : *protectionniste* (droits de 15 à 25 %, relevés en cas de déficit bilatéral, pas de traité), *modéré* (5 à 10 %, accepte un traité), *libéral* (0 à 3 %, propose lui-même un traité dès que la relation est cordiale).
   Le caractère montré au joueur est **composé de mots par trait** (« fier » pour une riposte, « rancunier » pour une mémoire tenace…), donc il avertit sans chiffrer, et reste cohérent d'une ville à l'autre.
4. **Les gestes de départ** : trois, pas quatre. *Un don* d'argent (au moins 100 €, effet proportionnel au montant, plafonné) ; *une mission de renouement* d'une relation rompue (coût fixe 300 €, délai de 6 mois) ; *honorer* une aide, qui se fait toute seule quand le prêt est remboursé. Un délai de 3 mois avant de refaire un même geste. *L'aide* (un prêt consenti à une ville) vient plus tard : elle demande un mécanisme de prêt en sens inverse.
5. **Les embargos** : par **partenaire, bien et sens**, avec un raccourci « tout un sens » qui en pose plusieurs d'un coup.
6. **La réciprocité** : décidée par la **personnalité**. *Encaisse* : aucune mesure, l'événement marque la relation. *Riposte* : une mesure miroir un mois plus tard (un embargo sur un bien qu'il nous vendait, si on lui coupe un bien qu'on lui vendait), annoncée par une dépêche qui en dit la cause. *Rompt* : rupture quand la relation passe sous son seuil.
7. **Les limitations en volume** : **globales** par bien et par sens (une loi de la ville, quel que soit le partenaire), par mois ; la place disponible se répartit dans l'ordre des commandes.
8. **Le traité de libre-échange** : douane préférentielle **par partenaire**, qui prime sur la générale ; elle plafonne à **0 à 5 %** tous les biens échangés avec lui, dans les deux sens, pour **5 ans** (puis renouvellement) ; exige une relation **cordiale** au moins et **12 mois** d'historique ; le rompre est un événement très lourd. Il peut venir de la **ville** (une proposition à un partenaire modéré ou libéral) ou du **partenaire** (un libéral le propose par une dépêche à choix) ; un protectionniste le refuse.
9. **La carte** : elle lit la **même requête** que la fiche dès l'étape 1 (pour ne jamais la contredire), sans refonte ; son redessin est vu plus tard.

### Les alertes de dépendance (ma proposition)

Le commentaire prévient dans deux cas, en deux niveaux, pour chaque sens :

- **Un seul partenaire** : de 50 %, un avertissement (« la moitié de vos ventes passe par une seule ville ») ; de 70 %, un avertissement fort (un embargo de sa part vous priverait de l'essentiel).
- **Un seul bien** : même seuils, sur les exportations (la ville vit d'un seul produit).
- **L'alimentation importée** : de 30 % de ce que mangent les habitants, un avertissement ; de 50 %, un avertissement fort (la sécurité alimentaire dépend d'un tiers).

Pourquoi ces seuils : à 50 % un seul acteur pèse plus que tous les autres ensemble ; à 70 %, la perte de cet acteur désorganise l'économie. L'alimentation a un seuil plus bas parce qu'une rupture y a des conséquences immédiates (la famine).

## Ce que ce plan prépare pour la politique

La relation est faite pour cela : la politique étrangère (alliances, sanctions, traités) et la politique intérieure (opinion, lobbies) y ajouteront des **genres d'événements**, des **gestes** et des **auteurs** et **causes** d'arrêt, sans toucher au reste. La satisfaction commerciale, elle, reste du pur business.
