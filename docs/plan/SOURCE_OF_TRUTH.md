# Source de vérité : état réel et cible

Ce document décrit ce que le code fait **aujourd'hui** (vérifié dans `src/`), puis la **cible**. Les anciens documents
(budget, balance, `JournalManager`, `BudgetProcessor`) sont dans `docs/archive/` : ils ne décrivent plus le code.
Les règles impératives sont dans `CLAUDE.md`.

## 1. État réel

| Donnée | Où elle est écrite | Qui la lit | Remarque |
|---|---|---|---|
| Tour (horloge du jeu) | `gameSettings`, ligne `clock` (`core/persistence/game-clock`) | tout le jeu | seule horloge |
| Calendrier (jours par mois) | `gameSettings`, figé à la création de la partie | tout le jeu | `config/events.js` |
| Journal de la mairie | `db.journal`, via `RecordLedgerEntry` | trésorerie, exports, panneau journal | seule trace de l'argent de la ville |
| Trésorerie | rien : **aucun solde stocké** | `GetTreasurySnapshot` (dérivé du journal) | conforme à CLAUDE.md |
| Flux de biens et services | `supplyTraceability` (supply) | règlement, panneaux, export | transactions par tour |
| Observations (ruptures, états, événements) | `supplyTraceability` | panneaux de traçabilité | pas des flux d'argent, mais même table |
| Mouvements privés (salaires, entretien, subventions, IS) | `supplyTraceability` (`recordEconomyMovement`) | export | écrits avant le journal, idempotents par clé métier |
| Charges mensuelles | calculées par `SettleProducerCharges` | journal | lit `houses` et `supplyTraceability` directement |
| Prix | `ValueChainCatalog` (marges) + `ResourceCategoryCatalog` (prix de base) | traçabilité | une seule source |
| Bâtiments et employés | table `houses` (`employees.workerSources`) | règlement, emploi | nom trompeur : la table porte tous les bâtiments |
| Stocks | état des bâtiments (supply) | simulation, panneaux | hors registre : un stock n'est pas un flux |

**Dépendances à corriger**
- `SettleProducerCharges` lit `houses` et `supplyTraceability` par des accès directs (une instance du repository créée
  dans la composition), sans port entre les contextes.
- Le schéma Dexie de `supplyTraceability` déclare les index `fromInstanceId` et `toInstanceId`, mais le code écrit
  `fromId` et `toId` : ces index ne servent à rien.
- La date des lignes de traçabilité est l'heure réelle (`new Date()`), pas le tour.
- Les lignes de traçabilité mélangent flux et observations dans une seule table.

## 2. Cible

Une seule direction de dépendance, quatre couches :

```
Bâtiments, employés, stocks (états, lus à la source)
        │
        ▼
Faits économiques  (une table : mouvements datés par tour, clé métier)
        │
        ├──► Registre économique  (projection lisible : par bâtiment et par mois, par paire)
        │          │
        │          ▼
        └──► Journal de la mairie (projection par les règles de la ville :
                                    TVA, IS, fonctionnaires, subventions, construction,
                                    emprunts, douane)
        │
        ▼
Vues d'interface (lisent le registre ou le journal, jamais les faits bruts)
```

**Règles de la cible**
- Un fait a une clé métier et un tour ; il n'est jamais modifié, seulement ajouté.
- Le registre et le journal sont des projections : ils se recalculent à partir des faits, ils ne stockent pas de
  résultat qu'ils ne peuvent pas retrouver.
- Le journal ne lit jamais un bâtiment directement : il lit le registre.
- Une observation (rupture, état, événement) n'est pas un fait économique : elle reste hors de la table des faits.
- Les contextes s'échangent des données par un port, pas par une table lue directement.

**Décisions encore ouvertes**
- Propriétaire de la table de faits : le contexte économie (recommandé) ou le contexte approvisionnement.
- Stockage du registre : résumé mensuel par bâtiment (recommandé, volume borné) ou calcul à la demande.
- Purge : garder N-1 en détail, purger N-2 après clôture annuelle ; les clôtures (`year_closing`) ne se purgent jamais.

## 3. Documents

| Document | Statut |
|---|---|
| `CLAUDE.md` | règles impératives, à jour |
| `docs/SOURCE_OF_TRUTH.md` | ce document |
| `docs/archive/*` | décrivent l'ancienne architecture (budget, balance, `JournalManager`, `BudgetProcessor`) : ne pas s'y fier |
| `src/contexts/accounting/` | pas de README à jour : ce document fait référence |
