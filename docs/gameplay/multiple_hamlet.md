# Constellation de hameaux

Vue d’ensemble et notes de conception pour le système **pays de hameaux** (une scène 3D à la fois, données à l’échelle du pays).

**Plan d’action détaillé (phases, tâches, critères de done) :** [`multiple_hamlet.plan.md`](multiple_hamlet.plan.md)

---

## Résumé

Anoria vise une population cumulée élevée (objectif 10 000+) sans augmenter le coût WebGL : le joueur ne voit qu’**un hameau** (grille 12–18) en 3D ; le reste du pays existe en **Dexie / RAM** et s’affiche sur les **cartes 2D** (ville, commerce).

| Décision | Choix |
|----------|--------|
| Nouveaux hameaux | Fondation sur site vierge |
| Trésorerie | Ledger pays + budget par hameau |
| Migration | Oui (data, pas agents 3D inter-map) |
| Routes | Voirie locale + arêtes pays (graphe 2D) |
| Nombre de hameaux | Dynamique |
| UI 3D | Inchangée ; navigation pays via cartes + loader |

## Stratégie retenue

**Swap de scène** (`unload` → `hydrate` → `initialize`) — même pattern que SimCity 4 (région 2D + une ville 3D). Pas de monde 3D continu, pas de scènes parallèles.

## Prérequis code

Avant multi-hameaux : **Phase 0** du plan — hydratation `city.tiles` depuis Dexie au boot (aujourd’hui manquante).
