# Anoria — Manuel du joueur (état actuel)

Ce document décrit **ce qui existe aujourd’hui** dans le jeu : règles, boucle, bâtiments, économie. Ce n’est pas une feuille de route — les idées futures viendront ensuite.

Anoria est un **city-builder web** (navigateur + Three.js) inspiré de César III / Pharaoh, mais à l’échelle d’un **village** : petite carte, peu de types de bâtiments, économie lisible. La particularité du jeu est la **comptabilité** : journal, trésorerie, impôts et paie sont au centre de l’expérience.

---

## 1. Démarrer une partie

| Paramètre | Valeur par défaut |
|-----------|-------------------|
| **Capital de départ** | 150 € |
| **Taille de la carte** | 16×16 cases (choix 12 à 18 au lancement) |
| **Calendrier** | Année 0 JC ; 12 mois par an |
| **Vitesse** | 1 tour ≈ 1 jour ; par défaut **1 jour = 1 mois** (réglable 1–30 jours/mois dans Paramètres) |
| **Intervalle entre tours** | 4 secondes (réglable 0,5 à 20 s avec lapin / escargot) |

Au lancement : choix de la taille de ville, puis le tutoriel peut démarrer automatiquement. La trésorerie et le HUD s’affichent dès que la scène est prête.

**Pause** : bouton pause dans le HUD — le temps et les citoyens s’arrêtent.

**Rejouer** : efface la sauvegarde locale et recharge la page.

---

## 2. Le temps qui passe

Chaque **tour** = **1 jour** de calendrier.

Quand le nombre de jours d’un mois est atteint (souvent **1 tour = 1 mois**), le jeu enchaîne les événements mensuels :

1. Accès route (parcelles)
2. Chaîne alimentaire (récoltes, marchés, consommation)
3. Croissance et évolution des maisons
4. Emploi (affectation des ouvriers)
5. Production usine (ex. meubles)
6. Commerce extérieur
7. Événements aléatoires (si activés)
8. **Budget du mois** : maintenance, salaires, indemnités chômage, impôt sur les salaires

Une fois par **an** (mois de **novembre**, index 10) : **impôt citoyen** (25 € par habitant des maisons bleues, rouges et violettes de **niveau 2** — le niveau 1 autarcique est exonéré).

---

## 3. La carte et les routes

- La ville est une **grille carrée** (typiquement 16×16).
- Une case = un bâtiment ou une route.
- **Route** = au moins un voisin orthogonal en route (`roadCount > 0`).

### Routes

| Outil | Coût | Usage |
|-------|------|--------|
| Chemin de pierre (StonePath) | 5 € / case | Clic maintenu pour peindre ; **R** pour tourner (horizontal / vertical / croisement) |
| Route moderne | 5 € / case | Variante visuelle |

**Maintenance routes** : 4 € / case / mois.

### Qui a besoin d’une route ?

| Bâtiment | Route pour fonctionner ? | Route pour peupler / embaucher ? |
|----------|--------------------------|----------------------------------|
| **Maison (Bleue/Rouge/Violette)** | Non — niveau 1 autarcique sans route | Route requise seulement pour passer au niveau 2 (métier + emploi) |
| **Palais (House-2Story)** | Oui (sinon population = 0) | Oui |
| **Ferme** | Non pour embaucher ; oui pour récolte / opérations | Embauche sans route possible |
| **Marché, moulin, grange, chai** | Oui | Oui (emploi) |

Les icônes sur la carte (pas de route, pas de bouffe, pas de travail) peuvent être masquées via l’onglet **Filtres → Production**.

---

## 4. Habitations

### Groupes sociaux (couleur = identité permanente)

Depuis la refonte « groupes sociaux », la **couleur** d’une maison est un **groupe social permanent** : elle ne change plus jamais après la pose (fini l’échelle Bleue → Rouge → Violette). Chaque groupe est **essentiel**, sans hiérarchie entre eux, et donne accès à des métiers différents :

| Couleur | Groupe social | Secteurs d’emploi accessibles (niveau 2) |
|---------|----------------|-------------------------------------------|
| Rouge | Artisans-ouvriers | Alimentation (fermes), Industrie, Stockage (moulin/grange) |
| Bleue | Commerçants | Commerce (marchés) |
| Violette | Savants | Services publics (chapelle, librairie) |

Le **Palais** (House-2Story) reste à part : c’est toujours l’ancien mécanisme d’élites (nourriture abondante + variété), débranché du nouveau système de groupes en attendant une passe dédiée.

### Niveaux (progression par instance)

Chaque maison Bleue/Rouge/Violette progresse **indépendamment de sa couleur** entre deux niveaux :

| Niveau | Nom | Route requise ? | Capacité max | Salaire / impôt |
|--------|-----|------------------|---------------|------------------|
| 1 | Chasseurs-cueilleurs (autarcie) | Non | 6 habitants | Aucun salaire, aucun impôt citoyen |
| 2 | Métier du groupe (spécialisé) | Oui | 12 habitants | Salaire + impôt citoyen normaux |

- **Niveau 1 → 2** : dès que la maison a une **route** et **au moins 1 habitant**.
- **Niveau 2 → 1** : si la route est **perdue**, la maison redescend en autarcie (population plafonnée à 6, jamais remise à zéro).
- Le niveau 1 ne dépend d’aucune ferme/marché : la maison **se nourrit elle-même** chaque mois (production de subsistance, voir §5).

**Maintenance** : 6 € / maison / mois, quel que soit le niveau.

### Croissance

- **+1 habitant par mois**, jusqu’à la capacité du niveau courant (6 en niveau 1, 12 en niveau 2).
- Le niveau 1 grandit **sans route** (autarcie) ; la route ne conditionne que le passage au niveau 2.
- Le **Palais** garde son ancienne règle : sans route, sa population retombe à 0.

### Déblocage dans la barre d’outils

- Au démarrage, seule la maison **Rouge** (artisans-ouvriers) est plaçable ; **Bleue** et **Violette** sont visibles mais grisées.
- Elles se débloquent dès que **2 maisons Rouge** ont atteint le **niveau 2** (constante ajustable — `RESIDENTIAL_UNLOCK_RED_LEVEL2_THRESHOLD`).
- La Violette peut aussi se débloquer via l’ancien objectif financier (**5 000 €** de trésorerie) — les deux conditions se cumulent en « ou ».

---

## 5. Agriculture et nourriture

### Fermes

| Ferme | Coût | Récolte | Ouvriers |
|-------|------|---------|----------|
| Blé | 10 € | wheat | 3 |
| Carotte | 20 € | carrot | 3 |
| Chou | 30 € | cabbage | 3 |

**Maintenance** : 2 € / ferme / mois.

- **Récolte** : **1 fois par an en automne**, **78 paniers** par ferme opérationnelle (route + ouvriers).
- Priorité de consommation dans les maisons : **blé → carotte → chou** (1 panier / citoyen / mois).

### Marché

| Type | Coût | Rôle |
|------|------|------|
| Étal (bleu ou rouge) | 10 € | Hub alimentaire |

- **2 ouvriers + 1 élite** par marché.
- **Automne** : achète aux fermes **proches**.
- **Reste de l’année** : **distribue** aux maisons dans un rayon de **5 cases** (Manhattan).
- Nécessite route + personnel.

### Moulin

| Coût | 50 € |
|------|------|
| **Ouvriers** | 4 + 2 élite |
| **Rôle** | En **décembre**, collecte le **surplus** de **toutes** les fermes de la ville |
| **Stockage** | Oui (capacité élevée ~1000) — **ne distribue pas** aux maisons |

### Chaîne alimentaire (résumé)

```
Fermes (automne, 78) → Marché (achat automne, distribution le reste de l’année) → Maisons
Surplus (décembre) → Moulin (stockage)
Maisons consomment 1 panier / habitant / mois
```

Le panneau **Administrateur → Traçabilité alimentaire** permet de suivre l’historique de consommation.

**Maisons de niveau 1 (autarcie)** : elles ne participent pas à cette chaîne — chaque mois, elles produisent directement leur propre nourriture (subsistance de chasse/cueillette) et ne consomment ni blé, ni carotte, ni chou du circuit fermes/marché.

---

## 6. Industrie et commerce extérieur

### Grange (Barn)

| Coût | 40 € (2×2 cases) |
|------|------------------|
| **Rôle** | Entrepôt **commerce extérieur** |
| **Capacité** | 10 unités / ouvrier, max **6 ouvriers** → **60 unités** total |
| **Marchandises** | bois, meubles, figues |

### Chai (Winery)

| Coût | 50 € |
|------|------|
| **Ouvriers** | 18 |
| **État** | Plaçable, embauche possible, cycle usine actif — **pas de chaîne vin → maisons** pour l’instant |

### Partenaires commerciaux

Activation d’une route commerciale : **500 €** (unique).

| Partenaire | Conditions d’ouverture | Achète chez vous | Vend à vous |
|------------|------------------------|------------------|-------------|
| **Olivea** | Pop ≥ 5, chômage ≤ 10 % | bois, meubles | figues |
| **Silvania** | (aucune extra) | meubles | — |

- Les échanges passent par la **grange** (stock bois / meubles / figues).
- **Blé, carotte, chou** ne sont **pas** dans le commerce MVP.
- Panneau **Administrateur → Commerce** + carte commerce.

---

## 7. Emploi

- Chaque bâtiment productif demande des **ouvriers** (et parfois des **élites**).
- Seuls les habitants des maisons **niveau 2** entrent dans les bassins de travailleurs (le niveau 1, autarcique, n’a ni salaire ni emploi).
- Depuis la refonte « groupes sociaux », l’affectation se fait **par groupe** : chaque groupe (artisans-ouvriers, commerçants, savants) a son **propre bassin de main-d’œuvre** et ne peut travailler que dans **ses** secteurs éligibles — un groupe en surplus ne peut jamais combler le manque d’un autre.
- **Chômeurs** : indemnités payées par la ville (**70 %** du salaire de référence par chômeur / mois) — **coût majeur** en early game. Le chiffre de chômage **global** reste affiché (détail par groupe disponible pour un futur tooltip).
- **Règle d’or** : construire les **emplois avant les maisons**, sinon la trésorerie s’effondre.

Secteurs et groupe éligible :

| Secteur | Exemples | Groupe |
|---------|----------|--------|
| 1 — Production alimentaire | Fermes | Artisans-ouvriers (Rouge) |
| 2 — Commerces | Marchés | Commerçants (Bleue) |
| 3 — Industries | Chai, usines | Artisans-ouvriers (Rouge) |
| 4 — Stockage | Moulin, grange | Artisans-ouvriers (Rouge) |
| 5 — Infrastructure | Routes (0 ouvrier) | Ouvert à tous |
| 6 — Services publics | Chapelle, librairie | Savants (Violette) |

---

## 8. Économie et fiscalité

### Dépenses automatiques (chaque mois)

| Poste | Détail |
|-------|--------|
| **Maintenance** | Routes 4 €, maisons 6 €, fermes/marchés 2 €, infra 2 €… |
| **Salaires fonctionnaires** | 1 fonctionnaire / 12 habitants × 100 € |
| **Indemnités chômage** | Chômeurs × 100 € × **70 %** |
| **Impôt sur les salaires** | **10 %** de l’assiette (salaires + indemnités + masse citoyenne) — **recette** |

### Recettes

| Poste | Quand |
|-------|--------|
| **Impôt citoyen** | **Novembre** : 25 € × habitants des maisons **niveau 2 uniquement** (bleue / rouge / violette ; le niveau 1 autarcique est exonéré, et le palais reste exclu du calcul affiché) |
| **Commerce** | Import / export via partenaires |
| **Prêts** | Emprunt possible (taux 5–14 % selon santé financière) |

### Construction

Coût immédiat à la pose (voir barre d’outils / journal `construction`).

### Comptabilité (interface joueur)

| Écran | Accès | Rôle |
|-------|-------|------|
| **Trésorerie HUD** | Haut de l’écran | Solde actuel |
| **Budget temps réel** | Panneau stats | Flux du tour |
| **Journal** | Paramètres → Journal | Toutes les écritures, filtres, export JSON/PDF |
| **Livret ville** | Admin → Finances | Comparaison année N / N−1 (style César III) |
| **Bilan / Compte de résultat** | Paramètres | États financiers annuels |
| **Prêts** | Paramètres → Prêts | Contracter / rembourser |

Le **journal** est la meilleure façon de comprendre pourquoi la ville gagne ou perd de l’argent.

### Réglages fiscaux (Admin → Travail)

- Salaire de référence (100 € par défaut)
- Taux impôt sur les salaires (10 %)
- Taux indemnités chômage (70 %)

*(Les valeurs peuvent être mémorisées dans le navigateur — une nouvelle partie peut garder d’anciens réglages tant que le cache n’est pas vidé.)*

---

## 9. Barre d’outils

### Onglet Bâtiments

| Groupe | Contenu (modal ou direct) |
|--------|---------------------------|
| **Outils** | Bulldozer, Sélection |
| **Habitations** | Maisons bleue / rouge / violette (+ générique) — bleue et violette grisées au démarrage, voir §4 |
| **Palais** | Maison à étages |
| **Agriculture** | Fermes, foin, charrettes… |
| **Industrie** | Moulin, grange, caisses, silos, chai |
| **Infrastructure** | Puits, fontaine, réverbère, clôture, étang, dalles (Plane), cube, sphères… |
| **Routes** | Route moderne, chemin de pierre |
| **Services** | Marchés bleu/rouge, église, chapelle, librairie |
| **Nature & décor** | Arbres, rochers ; bancs, arches, tombes… |

Beaucoup d’objets **décoratifs** n’ont **pas de mécanique** gameplay (placement + maintenance éventuelle).

### Onglet Filtres

- Afficher / masquer les **icônes de production** (fermes, marchés, affamés, sans emploi).

### Onglet Paramètres

- Vitesse, Bilan, Prêts, Compte de résultat, Journal, Tutoriel / Objectifs.

---

## 10. Contrôles

### Caméra

| Touche / souris | Action |
|-----------------|--------|
| **ZQSD / WASD / flèches** | Déplacer la vue |
| **Molette** | Zoom |
| **+ / −** | Zoom |
| **Clic gauche + glisser** | Rotation (mode perspective) |
| **Clic droit / milieu + glisser** | Pan |
| **R / T** ou **Shift + flèches** | Rotation vue (90°) |
| **I** | Basculer isométrique / perspective |

### Jeu

| Action | Détail |
|--------|--------|
| **Clic** | Placer / sélectionner |
| **Clic maintenu** | Peindre les routes |
| **R** (outil chemin de pierre) | Orienter le chemin |
| **Bulldozer** | Détruire un bâtiment |
| **Sélection** | Inspecter (panneau info bâtiment) — met le jeu en pause en mode sélection |

---

## 11. Événements aléatoires

Si activés (Paramètres) :

- **Ouragan** ou **inondation**
- Détruit **une maison** au hasard
- Coût réparation : **150 €** (`exceptional_expenses`)
- Fréquence par défaut : **5 % / tour**, après l’année 1, avec délai minimum entre deux événements

---

## 12. Objectifs, victoire, défaite

| Élément | État |
|---------|------|
| **Objectif 5 000 €** | Débloque maisons violettes en toolbar ; pas d’écran de victoire |
| **Game over (faillite / famine)** | Écran prévu dans l’UI — **non branché** au gameplay actuel |
| **Scénarios / missions** | Tutoriel de base ; pas de campagne structurée |

La partie peut continuer **en déficit** ; il n’y a pas de fin automatique aujourd’hui.

---

## 13. Multijoueur (expérimental)

- Option à la création de partie (pseudo, taille de salle).
- Nécessite un **serveur WebSocket** (port 9876).
- **Synchronisation principale** : placement de bâtiments entre joueurs — **pas** une simulation économique partagée complète.

---

## 14. Conseils de survie (early game)

1. **Capital 150 €** : marge quasi nulle — chaque mois de chômage coûte cher (~70 € / chômeur).
2. Ordre typique : **routes utiles → fermes + marché → 1–2 maisons** quand les postes existent.
3. Ne pas spammer les maisons : **emplois d’abord, habitants ensuite**.
4. Lire le **journal** après les 3 premiers mois de paie.
5. L’**impôt citoyen** (novembre) aide une fois par an — ce n’est pas une économie durable à lui seul.

---

## 15. Ce qui n’est pas encore (ou partiel)

Pour éviter les fausses attentes :

| Fonctionnalité | État |
|----------------|------|
| Vin / chaîne winery → maisons | Partiel |
| Game over faillite / famine | UI seulement |
| Santé (admin) | Données placeholder |
| Attractivité / fuite citoyens | Non implémenté |
| Grande carte / empire | Hors scope actuel (16×16 typique) |
| Campagne / victoire formelle | À inventer |
| Tous les outils décoratifs | Placement sans mécanique |

---

## 16. Identité du jeu (constat, pas promesse)

Aujourd’hui Anoria, c’est :

- un **village** sur une **petite grille** ;
- une **économie mensuelle** serrée (paie, chômage, maintenance) ;
- une **chaîne alimentaire** saisonnière (automne / distribution / moulin en décembre) ;
- un **commerce extérieur** limité (bois, meubles, figues) ;
- une **comptabilité détaillée** comme outil principal du joueur.

Ce manuel sera complété quand la vision gameplay (scénarios, échelle cible, fin de partie) sera formalisée.

---

*Dernière mise à jour : synthèse du code et des README des bounded contexts — à recouper après chaque grosse feature.*
