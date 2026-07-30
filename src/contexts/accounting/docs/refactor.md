# Accounting — notes de refactor

Historique des slices DDD. **Comportement actuel livret** : Phase 1–2a validées en jeu (2026-07).  
**Journal UI** : non migré — anomalies observées documentées ci-dessous.

Voir aussi [`../README.md`](../README.md) (spec Phase 0, cartographie, phases).

---

## Statut

| Slice | Description | Statut |
|---|---|---|
| 0 | Spec + ubiquitous language | ✅ |
| 1 | Livret ville → `GetCityLedgerYearComparison` + ACL | ✅ validé en jeu |
| 2a | Persistence Dexie (`DexieJournalRepository`, `DexieTreasuryRepository`) | ✅ |
| 2b | Journal UI → `GetGeneralLedger` + presenter pur | ✅ |
| 2c | Calculs nets livret hors presenter | 🔲 |
| **3½** | **Write path fiable + idempotence + réconciliation** | 🔲 **bloquant avant Phase 3** |
| 3 | Bilan + CR depuis journal (ports) | 🔲 **gated** |
| 4 | Réduction `BudgetManager` (legacy write éteint) | 🔲 |

---

## ⚠️ Journal = source de vérité — condition et risque (2026-07-30)

### Le problème

Si le journal devient la **seule** source de vérité **telle qu’il est aujourd’hui** (doublons D9, `turn` ≠ libellé mois), l’incohérence **se propage partout** :

```
db.journal (bruit)
    → GetGeneralLedger / GetCityLedgerYearComparison
    → livret, CR, bilan, export, réconciliation future
```

Ce n’est pas théorique : le **livret lit déjà les agrégats journal** pour les lignes revenus/dépenses ; seule la **balance N** vient de la trésorerie. Les `payroll_tax` doublons **gonflent déjà** les totaux livret/journal même quand le HUD reste cohérent.

### Modèle cible (inchangé) — deux rôles, une écriture

| Rôle | Source | Usage |
|---|---|---|
| **Mouvements** (grand livre, CR, lignes livret) | Journal **propre** | Agrégats par type/période |
| **Solde courant** (HUD, balance N livret) | Trésorerie co-maintenue | Perf temps réel |

Les deux doivent rester **réconciliables** (invariant 5 README). La trésorerie ne remplace pas un journal corrompu pour les **totaux historiques**.

### Décision : Phase 3 **bloquée** tant que le journal n’est pas fiable à l’écriture

**Ne pas** unifier bilan + CR sur le journal (Phase 3) avant :

1. **Phase 3½ — Write path BC** (ex-Phase 4, remontée prioritaire)
   - `RecordLedgerEntry` + `ApplyTreasuryMovement` (transaction logique)
   - **Idempotence** : ex. clé `(type, year, monthIndex)` ou `(turn, type, businessKey)` pour salaires / impôts / maintenance
   - Persistance champs **`year` + `month`** sur l’écriture (plus seulement le libellé)
   - Plus d’écriture directe `BudgetManager` → `JournalManager.addJournalEntry`

2. **Tests de réconciliation obligatoires**
   - `treasury.funds` ≈ solde journal (tolérance arrondi)
   - 1 salaire + 1 impôt max par mois civil simulé (property test vitesse rapide)
   - `GetCityLedgerYearComparison` = somme journal filtrée (sans doublons)

3. **Option migration** (parties longues existantes)
   - Script de dédoublonnage conservateur **ou** marquage `superseded` — **hors scope BC** sauf décision produit ; nouvelles parties propres dès Phase 3½.

### Ordre révisé

```
2c  livret presenter
      ↓
3½  write path + idempotence + réconciliation  ← BLOQUANT
      ↓
3   bilan + CR depuis journal
      ↓
4   extinction BudgetManager write
```

Phase 2 (lecture / ACL) reste valide : elle **prépare** le câblage sans promettre un journal déjà parfait.

---

## Observation en jeu (2026-07-30) — Journal vs Livret

**Livret ville (Admin → Finances)** : OK après Phase 1/2a.

**Journal (`#journal-panel`)** : affichage incohérent (capture utilisateur, année 5–6 ap JC).  
Hypothèse prioritaire : **présentation UI + wiring événements**, pas régression du flux Dexie / livret.

### Symptômes visibles

| Symptôme | Exemple capture |
|---|---|
| Entrée d’un mois « futur » au-dessus d’un en-tête mois antérieur | Salaires **Septembre 5** affiché avant le bloc **Août 5** |
| Libellé description ≠ en-tête mois du groupe | Impôt salaires « **Juillet** 5 » et « **Août** 5 » sous l’en-tête **Août 5 ap JC** |
| Totaux mois ≠ somme des lignes visibles | En-tête Août : Dépenses **-12 652 €** ; seule maintenance **-26 €** visible |
| Mélange revenus/dépenses du même mois civil | Trois lignes `payroll_tax` +840 € sous le même en-tête |

### Diagnostic probable (par priorité)

#### J1 — Filtres type sans recalcul des totaux (UI, **très probable**)

Fichier : `src/js/ui/journal/JournalManager.js` → `loadJournalEntries()`.

- Les **pills** (`journal-filter-pill`) filtrent les **lignes** (`filteredIncome` / `filteredExpenses`).
- Les **en-têtes mois/année** affichent toujours `monthData.income.total`, `monthData.expenses.total`, `monthData.netFlow` **bruts** (non filtrés).
- Effet : l’utilisateur voit un solde mensuel qui n’est pas la somme des lignes affichées — exactement la capture (gros total dépenses, une seule ligne maintenance visible).

**Correctif cible (Phase 2b)** : recalculer les totaux affichés à partir des entrées filtrées, ou afficher « partiel (filtre actif) ».

#### J2 — Paramètre `period` ignoré (UI, **confirmé**)

`loadJournalEntries(period, typeFilter)` reçoit `period` (`all`, etc.) depuis les boutons `.journal-filter-btn` mais **ne l’utilise jamais** dans le corps de la fonction.

**Correctif cible** : appliquer le filtre période côté query (`GetGeneralLedger`) ou filtrer `yearlyData` / `months` avant rendu.

#### J3 — Tri mois décroissant vs lecture chronologique (UX)

Agrégats (`journalAggregations.js`) trient les mois **du plus récent au plus ancien** (Septembre avant Août).  
Ce n’est pas un bug de données, mais l’ordre surprend si on lit comme un livre comptable chronologique.

**Correctif cible** : option tri asc/desc dans le presenter, ou libellé explicite « plus récent en haut ».

#### J4 — Side-effects à l’ouverture du journal (UI + legacy)

`loadJournalEntries()` **écrit** dans `localStorage` (`journal_year_end_balances`) à chaque ouverture / refresh, en mélangeant `budget.funds` (année courante) et `netFlow` / cache (années passées).

- Couplage presenter ↔ persistence cache (dette D5 du README).
- Peut désynchroniser report à nouveau vs agrégats journal.

**Correctif cible** : déplacer la logique dans un command/query BC ; le presenter ne fait que rendre.

#### J5 — Chemin de données hors BC (architecture)

Le journal UI appelle encore :

```text
window.journalManager || window.budgetManager
  → getYearlyFinancialSummary()   // store legacy, pas acl/accounting.js
```

Le livret passe par `DexieJournalRepository` ; le journal non — **deux chemins de lecture** (même table Dexie, même module d’agrégats depuis 2a, mais presenter non migré).

**Correctif cible (Phase 2b)** : `acl/accounting.js` → `GetGeneralLedger` → `DexieJournalRepository`.

#### J6 — Description vs `turn` / formats année (write path, **confirmé en base**)

Les agrégats mensuels regroupent par `TimeManager.getTimeInfo(entry.turn).monthIndex`.  
Les descriptions (« Juillet 5 », « Août 5 ») viennent du **texte saisi à l’écriture** (`BudgetProcessor`, `BudgetManager.addSalaryTax`).

**Confirmé** sur export `docs/ledgers/journal-2026-07-30.json` (partie ~41 ap JC, vitesse rapide) — ce n’est **pas** un artefact d’affichage Phase 2b :

| Observation | Exemple |
|---|---|
| Même `turn`, libellés mois différents | Tour **501** (= Octobre 41) : salaire + impôt **Septembre 41** et **Octobre 41** |
| Écritures dans la même milliseconde | 6 lignes tour 501 entre `18:06:34.382` et `.396` |
| Doublons massifs | **135** tours avec 2+ salaires, **133** avec 2+ `payroll_tax`, **69** avec libellés mois croisés sur le même tour |
| Maintenance année décalée | Description `Octobre **42**` alors que le jeu affiche **41 ap JC** (`BudgetProcessor` : `year = timeInfo.year + 1`) |

**Impact trésorerie / livret** : l’utilisateur constate une **concordance HUD / livret / budget** — cohérent car la trésorerie lit `budget_current.funds` (co-maintenu à l’écriture), pas la somme brute du journal. Les doublons **gonflent les agrégats journal** (revenus `payroll_tax` affichés) sans forcément refléter double débit trésorerie si courses async partielles — **à auditer en Phase 4**.

**Hypothèse cause racine (legacy, Phase 4)** : courses async `processBudget` / `addSalaries` à **vitesse de jeu élevée** — `updateTurn(time)` et `addJournalEntry(budget.turn, …)` intercalés entre deux mois simulés ; garde `lastSalaryMonth` insuffisante en concurrence.

**Priorité** : Phase 4 (`RecordLedgerEntry` + idempotence par mois/tour/type) — **hors scope** tant que le BC ne possède pas le write path.

#### J7 — Doublons salaires / impôts sur salaires (write path, **confirmé JSON**)

Voir analyse export 2026-07-30 ci-dessous. Ratio global `payroll_tax / salary = 0,200` (20 % exact) → paires cohérentes, mais **~701** lignes salaire pour **~538** mois uniques dans les libellés → sur-comptage journal.

**Affichage** : le regroupement par `turn` place des libellés « mois précédent » sous l’en-tête du mois du tour → effet « doublon mois différents dans le même mois UI » (capture Octobre 41).

---

## Analyse export jeu — `docs/ledgers/journal-2026-07-30.json` (2026-07-30)

Partie longue (~2861 écritures, commerce actif, années 0–41 ap JC).

### Verdict : problème **en base** (source), pas presenter

L’export JSON est produit par `JournalManager.exportToJSON()` directement depuis `db.journal`. Les doublons existent **avant** tout rendu UI.

### Incohérences repérées

| # | Type | Détail | Gravité affichage | Gravité trésorerie |
|---|---|---|---|---|
| A | Doublons salaire / `payroll_tax` | 133 tours avec 2+ impôts ; souvent 2 libellés mois sur 1 `turn` | Haute (journal) | Faible si budget OK |
| B | `turn` ≠ mois du libellé | Tour 501 → entrées Septembre + Octobre 41 | Haute (regroupement) | — |
| C | Maintenance `year + 1` | « Octobre **42** » vs année jeu 41 | Moyenne (libellé) | Faible |
| D | Doublons maintenance | 132 tours, ex. tour 501 Septembre + Octobre 42 | Moyenne | Faible |
| E | Tours avec 3+ impôts | 51 tours (ex. tour 14 : Mars + Avril + Mars) | Haute | À auditer |
| F | Agrégats annuels export | Année 41 : +22 400 / −764 565 incluent les doublons journal | Moyenne (CR futur) | — |

### Ce qui reste cohérent

- Ratio impôt salaires / masse salariale = **20 %** partout.
- Export `yearlySummary` interne cohérent avec somme des écritures (y compris doublons).
- Pas de signe d’ corruption Dexie (ids séquentiels, timestamps monotones par batch).

### Commerce (imports / exports)

Présents dans le fichier ; pas d’anomalie structurelle évidente au-delà du bruit salaires/maintenance (comptage non exhaustif — focus utilisateur sur impôts).

### Non-régression BC

Phase 2b **explique** le symptôme UI (regroupement par `turn` + libellé description) mais **ne le corrige pas** — correct tant que write path legacy. Ne pas « patcher » `BudgetProcessor` dans le refactor BC actuel.

---

## Dette journal UI (checklist Phase 2b)

| # | Sujet | Statut |
|---|---|---|
| J1 | Totaux en-tête ignorent filtre type | ✅ corrigé (`GetGeneralLedger`) |
| J2 | Filtre période non branché | ✅ corrigé (`periodDays`) |
| J3 | Tri mois décroissant non signalé | 🔲 UX optionnel |
| J4 | Écriture localStorage à l’affichage | ✅ supprimé du presenter |
| J5 | Pas d’ACL / pas de query BC | ✅ |
| J6 | Description vs `turn` / formats année | 🔲 legacy write — **confirmé JSON** |
| J7 | Doublons salaire / `payroll_tax` (vitesse jeu) | 🔲 Phase 4 idempotence |

---

## Phase 2b — livré

- `GetGeneralLedger` + `GeneralLedgerView` + filtres cohérents
- `getGeneralLedger()` dans `acl/accounting.js`
- Presenter journal DOM-only ; export JSON/PDF encore via store legacy

---

## Plan Phase 2b (journal) — archive

1. **`application/queries/journal/GetGeneralLedger.js`**
   - Paramètres : `period`, `types[]`, pagination optionnelle.
   - Retour : read model `{ years: [{ year, months: [{ month, income, expenses, entries, totals }] }] }` avec totaux **cohérents avec le filtre**.

2. **`acl/accounting.js`**
   - `getGeneralLedger(filters)` — seul entry point pour le presenter.

3. **Presenter `ui/journal/JournalManager.js`**
   - DOM + événements uniquement ;
   - supprimer accès `window.journalManager` / side-effects localStorage ;
   - recalcul totaux filtrés ou query pré-filtrée.

4. **Tests**
   - `getGeneralLedger.behavior.test.js` — filtres type/période, totaux = somme lignes ;
   - test régression : ouverture journal ne mutera pas localStorage.

---

## Non-régression livret

Tant que le journal n’est pas migré, **ne pas confondre** un bug d’affichage journal avec une régression livret :

| Surface | Chemin lecture | Validé |
|---|---|---|
| Livret ville | ACL → Dexie adapters | ✅ |
| Journal | Store → agrégats partagés, presenter legacy | ⚠️ UI |

Cross-check manuel : totaux livret N / types journal **sans filtre actif** doivent rester alignés.

---

## Références code

| Rôle | Chemin |
|---|---|
| Presenter journal (legacy) | `src/js/ui/journal/JournalManager.js` |
| Agrégats mensuels/annuels | `src/contexts/accounting/infrastructure/adapters/persistence/dexie/journalAggregations.js` |
| Écritures salaires / impôts | `src/js/game/managers/BudgetProcessor.js`, `BudgetManager.addSalaries` / `addSalaryTax` |
| Store journal (write + re-export) | `src/js/stores/JournalManager.js` |
| Spec BC | `src/contexts/accounting/README.md` |
