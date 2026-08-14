# Constellation de hameaux

Vue d’ensemble du système **multi-hameaux** : le jeu reste le même ; seul le **site 3D visible** change au voyage.

**Plan détaillé :** [`multiple_hamlet.plan.md`](multiple_hamlet.plan.md)

---

## Résumé

Anoria peut héberger **plusieurs hameaux** en data (objectif long terme : population cumulée élevée) **sans augmenter le coût WebGL** : le joueur ne voit qu’**une grille 12–18** à la fois ; les autres sites vivent en **IndexedDB** jusqu’au prochain voyage.

| Sujet | Choix v1 |
|--------|-----------|
| Gameplay 3D | **Inchangé** (construction, admin, pause, caméra) |
| Économie / tick | **Globale** — comme une seule ville |
| Bounded contexts | **Inchangés** ou filtre `hamletId` minimal sur Dexie |
| Voyage | **Carrousel** (FAB bas) + loader — **pas de carte pays** |
| Persistance | `houses` + `hamletId` ; tuiles dérivées au chargement |
| HUD pop | Totaux **pays** + chiffres **hameau visible** (couleur locale) |

## Principe technique

```text
IndexedDB (tous les hameaux)  →  toujours
city.tiles + scene 3D         →  hameau actif seulement
Voyage                        →  clear → hydrate → initialize
```

Pour le moteur métier, **c’est une ville** ; pour Three.js et Dexie, **c’est N sites** adressés par `hamletId`.

## Voyage (joueur)

1. Bouton **charrette** (barre du bas, à côté de la construction).
2. Carrousel des hameaux — actif en **vert**, clic sur un autre → **chargement**.
3. Site vierge : arbres / rochers aléatoires une fois ; ensuite construction normale.
4. Retour : bâtiments retrouvés depuis Dexie.

## HUD population (v1)

À côté de chaque stat **global** (partie entière), afficher la même stat pour le **hameau visible** dans une **autre couleur** :

```text
[icône] [total pays] [hameau actif]
```

**Exception — chômage :** deux lignes (pays, puis hameau), car le pourcentage ne tient pas sur une seule ligne côte à côte.

## Prérequis code

- Hydratation `city.tiles` depuis Dexie au boot et à chaque voyage (**Phase 0** — en place).
- `hamletId` sur les bâtiments et filtre session (**Phase 1** — en place).
- Swap scène + carrousel (**Phase 2** — prototype en place).
- Double affichage pop rail (**Phase 3** — à faire).

## Hors scope v1

Carte pays, routes entre hameaux, migration, tick abstrait des sites lointains, compta par hameau — voir **backlog v2** dans le plan.
