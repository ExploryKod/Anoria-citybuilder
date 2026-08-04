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

Une fois par **an** (mois de **novembre**, index 10) : **impôt citoyen** (25 € par habitant des maisons bleues, rouges et violettes).

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
| **Maison** | Oui (sinon population = 0) | Oui |
| **Ferme** | Non pour embaucher ; oui pour récolte / opérations | Embauche sans route possible |
| **Marché, moulin, grange, chai** | Oui | Oui (emploi) |

Les icônes sur la carte (pas de route, pas de bouffe, pas de travail) peuvent être masquées via l’onglet **Filtres → Production**.

---

## 4. Habitations

### Types

| Maison | Coût | Capacité |
|--------|------|----------|
| Bleue | 10 € | 6 habitants |
| Rouge | 10 € | 6 |
| Violette | 10 € | 6 |
| Palais (House-2Story) | 20 € | 7 (6 citoyens + 1 slot élite) |

**Maintenance** : 6 € / maison / mois.

### Croissance

- **+1 habitant par mois** par maison, jusqu’à la capacité max.
- **Condition** : la maison doit être **connectée à une route**.
- La nourriture **ne bloque pas** la croissance (mais l’évolution oui).

### Évolution (automatique)

| De → Vers | Conditions |
|-----------|------------|
| Bleue → Rouge | Au moins 1 habitant |
| Rouge → Bleue | 0 habitant |
| Rouge → Violette | Plus de 5 hab., route, nourriture ≥ population (pas affamés) |
| Violette → Rouge | Conditions violettes plus remplies |
| Violette → **Palais** | Nourriture > 2× population **et** au moins **2 types de récoltes** en stock |
| Palais → (descente) | Perte du surplus alimentaire ; rétrogradation selon population |

### Objectif financier (soft)

Atteindre **5 000 €** de trésorerie **débloque le placement direct** de maisons violettes dans la barre d’outils (en plus de l’évolution naturelle).

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
- La ville affecte les habitants **par secteur**, avec priorités (production alimentaire en premier, etc.).
- **Chômeurs** : indemnités payées par la ville (**70 %** du salaire de référence par chômeur / mois) — **coût majeur** en early game.
- **Règle d’or** : construire les **emplois avant les maisons**, sinon la trésorerie s’effondre.

Secteurs (simplifié) :

| Secteur | Exemples |
|---------|----------|
| Production alimentaire | Fermes |
| Commerces | Marchés |
| Industries | Moulin, grange, chai |
| Infrastructure | Routes (0 ouvrier) |

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
| **Impôt citoyen** | **Novembre** : 25 € × habitants (maisons bleue / rouge / violette ; palais exclu du calcul affiché) |
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
| **Habitations** | Maisons bleue / rouge / violette (+ générique) |
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
