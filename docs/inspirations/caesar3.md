# Caesar III / Augustus — comparaison avec Anoria et feuille de route

> Objectif : situer Anoria par rapport à [Augustus](https://github.com/Keriew/augustus)
> (fork de Julius, lui-même réécriture open source de Caesar III), dire ce qui vaut
> mieux d'un côté ou de l'autre, lister ce qui manque, et proposer un chemin vers un jeu
> très proche d'Augustus **sans 3D lourde**.
>
> Les chiffres marqués *(≈)* viennent de la connaissance du jeu et sont à recouper avec le
> manuel ([Augustus Ultimate Handbook](https://www.caesar3augustus.com/)) ou en jouant.
> Les pages du manuel consultées lors de la rédaction ne contenaient que des sommaires
> (ratings, people, farmingindustry) : aucune valeur n'en est tirée. La section 2bis, elle,
> vient des captures d'écran d'Augustus fournies par le concepteur (constats fiables).

## 1. Principe directeur

| | Caesar III / Augustus | Anoria |
|---|---|---|
| Données | Codées en dur dans le moteur (tables de C) | **Catalogue déclaratif** (`buildingEconomy.js`, mesh catalog, catégories sociales) ; le code ne connaît que des rôles (producer, collector, hub, distributor, consumer) |
| Temps | 1 mois = 15 jours ; simulation par tick fin | 1 tick = 1 jour ; le cycle « mensuel » tourne à chaque tick |
| Rendu | Sprites 2D isométriques | Three.js, kits Kenney, sprites d'état |
| Sauvegarde | Fichier `.sav` | Dexie (IndexedDB), migrations versionnées |

**Avis** : le catalogue déclaratif est un vrai avantage sur Augustus (mod-friendly, équilibrage
sans toucher au code). À garder comme règle absolue. En revanche, Augustus a 25 ans
d'équilibrage : copier ses *valeurs* dans le catalogue est légitime, copier ses *mécanismes*
doit passer par un rôle générique.

## 2. Comparaison système par système

Légende : ✅ équivalent présent · 🟡 partiel · ❌ absent

### 2.1 Habitat et évolution
| Augustus | Anoria | Statut |
|---|---|---|
| Lotissement (zone) qui évolue : tente → cabane → maison → villa → palais (≈ 20 niveaux) selon accès service/denrées/désirabilité | 3 types de maisons = 3 catégories sociales (Commerçants / Artisans-ouvriers / Savants), chacune avec paliers et exigences | 🟡 |
| Évolution *et régression* automatiques selon ce que la maison reçoit | Départ d'habitants quand le standing change (message « manque de nourriture ») | 🟡 |
| Capacité croissante avec le niveau | Capacité par type | 🟡 |

**Avis** : Augustus l'emporte sur la granularité (ladder long, lisible : le joueur voit *pourquoi* la
maison n'évolue pas). Anoria l'emporte sur l'identité (3 classes sociales avec un rôle économique
distinct — employés, clientèle). **Recommandation** : garder les 3 classes comme *axes* et ajouter
un ladder de paliers à l'intérieur de chaque classe (déjà prévu dans le plan « evolution ladder »).

### 2.2 Désirabilité / esthétique
| Augustus | Anoria | Statut |
|---|---|---|
| Carte de désirabilité : jardins, statues, plazas (+), greniers, industries, entrepôts (−) ; calculée par rayon | Rien de tel ; arbres/rochers purement décoratifs | ❌ |
| Overlay « désirabilité » | — | ❌ |

**Avis** : c'est le mécanisme qui donne du *jeu de placement* à Caesar III (où mettre l'industrie
bruyante ?). À adopter : un champ `desirability: { value, range }` par bâtiment dans le catalogue,
un moteur générique (même patron que `roadRange`), et les maisons lisent la somme sur leur emprise.

### 2.3 Services et couverture
| Augustus | Anoria | Statut |
|---|---|---|
| Marcheurs de service (préfet, médecin, barbier, inspecteur, prêtre…) qui *passent* devant les maisons et leur accordent un compteur | Couverture par rayon/catégorie (`serviceCoverage`) : Chapelle, École, Bibliothèque, Cabinet, Hôpital, Bains, Théâtre, Cinéma, Taverne | 🟡 |
| Le marcheur suit la route, jamais de rayon magique | Pas de marcheur : couverture par distance | 🟡 |

**Avis** : le *rayon* d'Anoria est plus simple, plus performant et plus lisible ; le *marcheur*
d'Augustus crée le jeu de layout (un carrefour mal placé = trou de couverture). Compromis
recommandé : rayon **mesuré le long du réseau routier** (distance de chemin depuis le bâtiment,
pas Manhattan brut), sans entité animée. Le rendu d'un marcheur simple (sprite qui se déplace)
reste peu coûteux si on le veut plus tard, en pur cosmétique.

### 2.4 Eau
| Augustus | Anoria | Statut |
|---|---|---|
| Fontaines, puits, réservoirs, aqueducs ; effets santé/évolution | Aucun | ❌ |

**Avis** : à ajouter dans le ladder d'évolution (exigence « eau » d'une maison). Peut être un rôle
`distributor` d'un bien immatériel « eau » avec réseau (aqueduc) → nécessite un graphe de
connexion, pas de marcheur.

### 2.5 Alimentation
| Augustus | Anoria | Statut |
|---|---|---|
| Fermes (blé, légumes, fruits, olives, vigne, porc), greniers, marchés avec acheteuses | Champs blé/carotte/chou, Moulin, Étals (distributor), Entrepôt-hub, saisonnalité `cycle`/`sale` | ✅ |
| Marchés qui *achètent* aux greniers via marcheuse puis vendent aux maisons | `CollectResourceToHub` + distributor | ✅ |
| Granary / Warehouse avec *ordres de stockage* (accepter, refuser, vider) | Entrepôt choisit ce qu'il accepte via le catalogue (nourriture / biens) | 🟡 |
| Famine → départ | Départ d'habitants (demandMet) | ✅ |

**Avis** : Anoria a **mieux** sur les cycles agricoles (semailles, `missed`, `wait`, fenêtre de
vente) : Augustus n'a qu'un rendement mensuel continu. À garder. Manque : ordres de stockage
modifiables **par le joueur** (le catalogue les fixe aujourd'hui) — à exposer comme réglage par
instance qui surcharge la valeur du catalogue.

### 2.6 Industrie et biens
| Augustus | Anoria | Statut |
|---|---|---|
| Chaînes : argile → poterie ; bois → meubles ; fer → armes ; huile ; vin | Bûcheron → meubles ; ateliers plats/pots/amphores ; proximité de ressource brute (`naturalResource`) | ✅ (moins de chaînes) |
| Entrepôts + porteurs de chariot | Entrepôt-hub, collecteur | ✅ |
| Import/export de biens | Absent | ❌ |

**Avis** : notre mécanisme de ressource brute à proximité (arbre, épuisement) est plus riche
qu'Augustus (mines/argile en carrière fixes). Ajouter *fer, argile, marbre, huile, vin* est du
**catalogue pur** — c'est la meilleure preuve de la thèse déclarative, à faire tôt.

### 2.7 Commerce et carte de l'empire
| Augustus | Anoria | Statut |
|---|---|---|
| Carte de l'empire, routes terrestres/maritimes, villes commerçantes, quotas import/export, ports (quai), caravanes | Pages `world`/`hamlets` existent, mais pas de commerce entre villes | ❌ |
| Prix d'achat/vente par bien | — | ❌ |

**Avis** : c'est le plus gros chantier fonctionnel. Fait à 2D pur (une carte plate, des
lignes de routes, pas de rendu 3D). Anoria a déjà le contexte `world-layout`/`geography` sur
lequel s'appuyer. Prévoir un contexte `trade` neuf.

### 2.8 Emploi et travailleurs
| Augustus | Anoria | Statut |
|---|---|---|
| Pool d'emploi global : chaque bâtiment reçoit une proportion selon priorité ; « chômage » % | Contexte `employment` : besoins par bâtiment, ligne « Ouvriers · catégorie » ; secteurs | ✅ |
| Priorités d'emploi modifiables (« labor advisor ») | Absentes | 🟡 |
| Salaires nationaux | Contexte `accounting` complet (journal, bilan, prêts…) | ✅ (plus riche) |

**Avis** : Anoria a une comptabilité **bien plus poussée** qu'Augustus (bilan, compte de
résultat, prêts). C'est un atout de différenciation. Ajouter la *priorité d'emploi* par
secteur (routage) — troisième phase du plan déjà en mémoire.

### 2.9 Finances
| Augustus | Anoria | Statut |
|---|---|---|
| Impôts par collecteur (marcheur), pas de revenu si pas couvert | Impôts/loyers dans compta | 🟡 |
| Salaires, dons à César, prêts, dette | Prêts, trésorerie, journal | ✅ |

**Avis** : un impôt *couvert par un collecteur* est un très bon levier de layout ; à traiter
comme un service (§2.3) : rôle `collector` de bien « impôt ».

### 2.10 Ratings et objectifs
| Augustus | Anoria | Statut |
|---|---|---|
| 4 ratings : Culture, Prospérité, Paix, Faveur ; objectifs de scénario ; promotion | `missions`, `scenarios` (pages) | 🟡 |
| Demandes de César (ressources, argent) | — | ❌ |
| Événements : révoltes, invasions, empereur | — | ❌ |

**Avis** : adopter les 4 ratings comme **agrégations déclaratives** (chaque bâtiment/service
déclare sa contribution) ; la victoire d'un scénario devient une conjonction de seuils
lisibles dans le catalogue du scénario.

### 2.11 Ordre public, feu, effondrement, peste
| Augustus | Anoria | Statut |
|---|---|---|
| Préfets (feu), ingénieurs (effondrement), médecins (peste), prétoire (crime) ; risques par bâtiment | Santé (Cabinet, Hôpital) et panel `health` | 🟡 |
| Incendie et effondrement aléatoires selon risque | Absents | ❌ |

**Avis** : à garder **optionnel**. Ces catastrophes sont une source de frustration si
mal réglées ; les implémenter comme un risque `hazard` déclaré + service d'annulation.
Les rendre désactivables par scénario.

### 2.12 Militaire et murailles
| Augustus | Anoria | Statut |
|---|---|---|
| Forts, casernes, légions, tours, murs, invasions, batailles | Aucun | ❌ |

**Avis** : **à reporter en dernier**, voire à ne pas faire. C'est un jeu dans le jeu ;
Anoria a une identité économique/comptable qui se suffit. Si fait : combat résolu
statistiquement (pas de mêlée animée).

### 2.12b Religion, culture, divertissement
| Augustus | Anoria | Statut |
|---|---|---|
| 5 dieux (Cérès, Neptune, Mercure, Mars, Vénus), temples, oracles, humeur des dieux | Chapelle (foi) | 🟡 |
| Théâtre, amphithéâtre, colisée, hippodrome (écoles de gladiateurs, lions…) | Théâtre, Cinéma, Taverne | 🟡 |
| Éducation : école, académie, bibliothèque | École, Bibliothèque | ✅ |

**Avis** : le décor d'Anoria (Cinéma, Bains…) est plus moderne que Rome ; c'est un choix d'univers.
Ne pas copier les 5 dieux si l'univers n'est pas romain. Garder la structure : *n* catégories de
service × paliers, déclarées dans `socialCategoryCatalog`.

### 2.13 Réseau routier
| Augustus | Anoria | Statut |
|---|---|---|
| Routes, places (plazas), routes pavées, barrières (roadblocks), autoroutes/portes | StonePath (1 route), accès par distance Manhattan de l'emprise | 🟡 |
| Marcheurs à sens aléatoire aux carrefours | — | ❌ |

**Avis** : Manhattan sur l'emprise est un excellent compromis. Ajouter *plaza* (désirabilité) et
*barrière* (bloque le passage d'un type de service) reste du catalogue + une règle de graphe.

### 2.14 Interface, informations, conseillers
| Augustus | Anoria | Statut |
|---|---|---|
| Overlays (eau, feu, crime, désirabilité, emploi, services…) | Sprites d'état au-dessus des bâtiments (no-road, no-work, no-resource, sale…) | 🟡 |
| Conseillers (travail, militaire, imperial, ratings, commerce, population, santé, éducation, divertissement, religion, finances, chef) | Panneaux admin : work, storage, food-traceability, finances, report, health, archives | 🟡 |
| Graphes d'historique population, recensement | `archives`, `report` | 🟡 |
| Messages/journal d'événements (« la ville a besoin de… ») | Toasts, news | ✅ |
| Vitesse de jeu, pause | À vérifier | 🟡 |

**Avis** : les **overlays** sont l'outil d'information numéro 1 d'Augustus. À implémenter en
2D sur la couche existante : un mode de coloration des tuiles/bâtiments selon une *métrique*
déclarée dans le catalogue (aucun rendu spécifique).

## 2bis. Ce que montrent les captures d'Augustus (cité de ~5 700 habitants, an 82)

Constats faits directement sur les écrans, donc fiables (contrairement au reste du §2).

**Écran principal**
- Barre du haut : trésor (Dn), population, date. Panneau de droite : vitesse de jeu (80 %/200 %,
  pause), chômage (« 0 % (5) »), invasions, dieux, puis **les 4 ratings « valeur (objectif) »**
  (Culture 62/75, Prospérité 63/75, Paix 100/60, Faveur 88/75), population « 5 717 (10 000) »
  et demandes en cours. Tout est visible en permanence : le joueur sait toujours ce qui lui manque.
- Menu **Overlays** : Normal, Eau, Risques, Divertissement (sous-menu : global, taverne, théâtre,
  amphithéâtre, arène, colisée, hippodrome), Éducation, Santé, Commerce, Religion, Routes,
  Désirabilité, Sentiment. Le sous-menu par service permet de voir **la couverture d'un seul type**.
- Overlay Désirabilité : dégradé de couleur par tuile (bleu = très désirable, vert → jaune → rouge).
  Overlay Divertissement : colonnes de hauteur variable sur chaque maison = niveau de couverture.
  Overlay Sentiment : maisons assombries. Ce sont des **teintes/hauteurs plates**, donc peu coûteuses.

**Fenêtre d'une maison** (« Large insulae »)
- Message explicite : *« cette maison ne peut pas évoluer : elle a besoin d'un second type de nourriture,
  fournie par un marché local »*. Puis occupants (84), impôt généré (161 Dn), humeur (« Residents
  love you »), et **le stock de chaque bien détenu** (blé, légumes, viande, poterie, meubles, huile, vin).
- Les biens manufacturés (poterie, meubles, huile, vin) sont **consommés par les maisons** et
  conditionnent leur évolution. C'est exactement le rôle que jouent déjà tes ateliers (plats, pots,
  amphores, meubles) : le lien « bien → palier de maison » est la pièce manquante.

**Fenêtre d'un bâtiment de service** (Hôpital) : « 30 employés (30 requis) », description, boutons
d'action. Équivalent direct de ta ligne « Employés x/y ».

**Conseillers**
- *Logement* : nombre de maisons par niveau (petite casa … grand insulae), total de résidences,
  capacité disponible/totale, et **nombre de résidences qui utilisent chaque bien** (poterie 93,
  meubles 91, huile 45, vin 0).
- *Population* : trois vues — Historique (courbe), Recensement (pyramide des âges, âge moyen 35,
  **43 % de la population dans la main-d'œuvre**, naissances/décès de l'année), Société (répartition
  par revenu, impôt moyen par résidence 148 Dn). Texte de synthèse : greniers (« nourriture pour
  1 mois »), variétés de nourriture consommées, **« le manque de logements vacants limite l'immigration »**.
- *Ratings* : quatre colonnes avec « requis », plus le texte de **la cause qui bloque** le rating le plus
  faible (« la qualité globale du logement retient ce rating »).
- *Finances* : trésorerie, **taux d'impôt réglable (8 % → rendement estimé)**, part de la population
  imposée (77 %), tableau « année dernière / cette année » : impôts, recettes commerciales, divers,
  dons ; importations, salaires, construction, taxes sur bâtiments, salaire personnel, divers,
  tribut/intérêts ; flux net et solde.
- *Main-d'œuvre* : 9 secteurs (Industrie et commerce, Nourriture, Ingénierie, Eau, Préfectures,
  Militaire, Divertissement, Santé et éducation, Gouvernance/religion) avec **priorité 1–9 modifiable,
  besoin et pourvu**, total employés/chômeurs, **salaire réglable (36 Dn) face au salaire de Rome**
  et facture annuelle.
- *Commerce* : par bien, stock + état (« importable », « exporte au-dessus de N », « importe N »).
  Fenêtre de détail : industries actives, unités en entrepôt, **interrupteur « Industry is ON »**,
  option **stockage forcé** (« utiliser et commercer / stocker »), bouton « Show prices ».
- *Conseiller en chef* : une ligne par domaine (emploi, finances, migration, logement, stocks et
  consommation de nourriture, militaire, crime, santé, éducation, religion, divertissement, humeur
  de la cité), **en rouge quand il y a un problème**, avec une phrase actionnable.
- *Carte de l'empire* : villes avec bannières (couleur = statut), routes terrestres et maritimes,
  par ville **quotas vendus/achetés (« 0 sur 40 », « 5 sur 40 »)** avec l'icône du bien.

**Portée visible avant la pose** (capture pendant le placement d'un bâtiment de service)
- Pendant que le joueur tient le bâtiment, **les routes couvertes par sa portée passent en bleuté** ;
  le reste du réseau garde sa couleur. La portée est donc montrée **sur le réseau routier**, pas
  comme un cercle : elle reflète le fait que le marcheur ne sert que ce qu'il longe.
- L'emprise fantôme est **verte ou rouge par tuile** (posable / bloquée), avec la teinte sur les
  routes en plus. Le joueur juge l'emplacement avant de payer.
- Cela colle à ton modèle : `roadRange` (Manhattan depuis l'emprise) et la portée d'un collecteur ou
  d'un distributeur sont déjà déclarés dans le catalogue. Il suffit de les **teinter au fantôme**
  (routes à portée) via la même valeur, sans nouvelle donnée. Les maisons dans la portée peuvent
  aussi être surlignées, ce qui répond à « ce bâtiment servira-t-il quelqu'un ? ».

**Enseignements pour Anoria**
0. **Prévisualiser la portée** au placement (routes à portée teintées, maisons couvertes
   surlignées) : c'est l'aide au placement la plus rentable, et elle réutilise les portées du catalogue.
1. Le **conseiller en chef** (une phrase par domaine, rouge si problème) est le meilleur rapport
   valeur/coût : tout se dérive des métriques déjà calculées. À mettre en premier.
2. La fenêtre de maison doit **dire pourquoi elle n'évolue pas** et lister ce qu'elle détient.
3. Les **priorités d'emploi** sont une liste ordonnée de secteurs : c'est un simple tri appliqué au
   contexte `employment` (tes secteurs existent déjà).
4. **Impôt et salaire réglables** manquent : deux curseurs dans le contexte `accounting`.
5. Le **panneau de droite permanent** (ratings vs objectifs, chômage, population cible, demandes)
   remplacerait avantageusement des panneaux à ouvrir.
6. Les **overlays** utilisent la même donnée que les statuts : couleur de tuile selon une métrique.

## 3. Ce qu'Anoria fait mieux

1. **Catalogue déclaratif** : équilibrage, mods, variantes de monde sans recompiler.
2. **Cycles de production réalistes** (`cycle`, `missed`, `wait`, `sale`) et saisonnalité.
3. **Comptabilité complète** (double entrée, bilan, prêts, trésorerie).
4. **Traçabilité alimentaire** (`food-traceability`).
5. **Ressource brute à proximité** avec épuisement.
6. **Statuts visibles** sur chaque bâtiment (priorité route > travail > ressource) — Augustus
   demande d'ouvrir un overlay pour obtenir la même chose.
7. **Multi-cartes / hameaux / scénarios** comme structure de campagne moderne.

## 4. Ce qu'Augustus a et qu'Anoria n'a pas (classé par valeur de jeu)

| Rang | Manque | Effort | Rendu 3D requis |
|---|---|---|---|
| 1 | Ladder d'évolution long des maisons + explication « pourquoi pas d'évolution » | M | non |
| 2 | Désirabilité + overlay | M | non |
| 3 | Couverture par service *le long des routes* (distance de chemin) | M | non |
| 4 | Eau (puits/fontaine/aqueduc) | M | non |
| 5 | 4 ratings + objectifs de scénario + demandes de César | M | non |
| 6 | Overlays d'information (métriques du catalogue) | M | non |
| 7 | Commerce/empire : carte, import/export, prix | L | non (carte 2D) |
| 8 | Impôts par collecteur | S | non |
| 9 | Chaînes industrielles supplémentaires (fer, argile, huile, vin…) | S (catalogue) | non |
| 10 | Ordres de stockage modifiables par le joueur | S | non |
| 11 | Priorités d'emploi | S | non |
| 12 | Risques : feu, effondrement, peste, crime | M | non (effet 2D) |
| 13 | Plazas, jardins, statues, barrières | S | non |
| 14 | Monuments (grands bâtiments-objectifs) | S | modèle simple |
| 15 | Militaire/invasions | XL | à éviter |
| 16 | Marcheurs animés | M | sprites |

## 5. Ce que la contrainte « pas de 3D lourde » change

- Pas de foule animée : **résultats calculés, pas simulés visuellement**. Marcheur = distance
  de chemin + flag visuel de couverture ; au plus quelques sprites cosmétiques.
- Pas de fondus/particules coûteux : feu/effondrement = changement de sprite d'état.
- Instancier les meshes répétés (routes, arbres, maisons) et limiter les matériaux.
- Overlays = teinte plate par tuile (pas de post-traitement).
- Carte de l'empire = page 2D (canvas/SVG), sans Three.js.

## 6. Feuille de route proposée

Chaque phase reste **catalogue d'abord**, moteur générique ensuite, et respecte : pas de
fallback silencieux, libellés issus du catalogue, tests minimaux.

**Phase A — Habitat lisible (déjà amorcée)**
1. Couverture de service par distance de route (rôle générique).
2. Ladder d'évolution par classe sociale (paliers et exigences dans le catalogue).
3. Panneau « pourquoi ma maison n'évolue pas » (exigences manquantes).

**Phase B — Placement intéressant**
4. Désirabilité (`desirability` catalogue + overlay).
5. Eau (aqueduc/fontaine) comme exigence de palier.
6. Plazas, jardins, statues.

**Phase C — Pilotage**
7. Overlays de métriques (services, désirabilité, emploi, eau).
8. Priorités d'emploi et ordres de stockage par instance.
9. Impôts par collecteur.
10. Chaînes industrielles supplémentaires (catalogue).

**Phase D — Objectifs**
11. 4 ratings agrégés depuis le catalogue.
12. Scénarios = conjonction de seuils + demandes impériales.
13. Événements optionnels (feu, effondrement, peste, crime) par risque déclaré.

**Phase E — Monde**
14. Carte de l'empire 2D, routes commerciales, quotas, prix, ports.
15. Monuments-objectifs.

**Phase F — Optionnel**
16. Militaire résolu statistiquement.

## 7. Décisions à trancher (pour le concepteur)

- Univers : Rome fidèle (dieux, gladiateurs) ou univers propre (déjà Cinéma, Bains publics) ?
- Difficulté des catastrophes : activées par défaut ou par scénario ?
- Commerce : mono-ville avec marché mondial abstrait, ou vraie carte d'empire ?

## 8. Sources

- [Augustus — dépôt et README](https://github.com/Keriew/augustus)
- [Augustus — versions](https://github.com/Keriew/augustus/releases)
- [Augustus Ultimate Handbook](https://www.caesar3augustus.com/) (chapitres : people, gameratings,
  farmingindustry, trade, water, health, religion, entertainment…)
- Captures de jeu fournies par le concepteur (Augustus, sept. 2026)
- Plan interne : mémoire « Caesar 3 mechanics port plan » (couverture, ladder d'évolution,
  routage du travail) et `docs/gameplay/game_vision.md` (partiellement obsolète)
