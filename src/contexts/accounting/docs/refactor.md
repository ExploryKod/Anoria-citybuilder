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
| **3½** | **Write path fiable + idempotence + réconciliation** | 🟡 slice 1 (buffer session) |
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
| J7 | Doublons salaire / `payroll_tax` (vitesse jeu) | ✅ idempotence BC |
| J8 | Prêts indexés sur **tour** vs finances sur **temps civil** | 🔲 dette produit — voir ci-dessous |

---

## Dette produit — prêts en « tours » vs calendrier civil (J8)

### Constat

La plupart des postes financiers visibles par le joueur sont ancrés sur le **temps civil** (`TimeManager`) :

- salaires / impôt paie → **1× par mois civil** (`businessKey` `{year}:{monthIndex}`)
- maintenance → idem
- impôt citoyen → **1× par année civile** (novembre)

Les **prêts** suivent un modèle différent hérité du legacy :

- durée et échéances en **nombre de tours** (`loan.duration`, `remainingTurns`)
- `processLoanPayments()` appelé **à chaque tour** (et parfois deux fois : `BudgetProcessor` + `game.onTurnEnd`)
- idempotence BC actuelle : `loan_interest:{loanId}:{turn}` et `loan_repayment:{loanId}:{turn}` — donc **par tour de simulation**, pas par mois affiché dans le journal

### Pourquoi c’est questionnable

1. **Cohérence UX** : le joueur lit « Juin 3 ap JC » dans le journal ; les prêts ne s’alignent pas sur ce rythme.
2. **Vitesse de jeu** : à 2× ou si `days_per_month` change, le rapport « une mensualité = un mois ressenti » ne tient plus.
3. **Double hook** : deux appels `processLoanPayments` sur le même tour étaient un risque de doublon — l’idempotence `{loanId}:{turn}` le neutralise, mais masque le problème d’orchestration.

### Idempotence livrée (Phase 3½)

| Type | `businessKey` | Règle |
|---|---|---|
| `loan_capital` | `loan_capital:{loanId}` | 1 tirage par contrat |
| `loan_interest` | `loan_interest:{loanId}:{turn}` | 1 intérêt max / prêt / tour |
| `loan_repayment` | `loan_repayment:{loanId}:{turn}` | 1 remboursement capital max / prêt / tour |

Sans `loanId`, pas de clé (compat legacy) — comportement non idempotent.

### Piste refactor (hors scope immédiat)

- Aligner les échéances sur **mois civil** (ou `dayInMonth === 1`) comme salaires
- Ou afficher explicitement « échéance 3/10 » plutôt qu’un mois calendaire
- Fusionner les hooks de paiement en un seul orchestrateur par tour
- Éventuelle clé future : `loan_interest:{loanId}:{year}:{monthIndex}` si le produit bascule sur mensualités civiles

---

## Dette legacy restante — écritures et incohérences (Phase 4+)

Inventaire après migration Phase 3½ (write path opérationnel). **Ne pas patcher ad hoc** : traiter en slice dédiée ou produit.

| ID | Sujet | Constat legacy | Action future |
|---|---|---|---|
| D6 | `addIncome()` | **Corrigé Phase 4** — remplacé par `RecordConstructionRefundIncome` (`construction_refund`) ; `addIncome()` déprécié (throw) | — |
| D7 | `RandomEventsService` (réparations) | **Corrigé Phase 3½** — avant : `db.budget.put` + `addJournalEntry` séparés (split-brain) | — |
| D8 | `capital_funds` vs trésorerie | **Corrigé Phase 4** — `initialize()` amorce `funds` **et** `income` ; journal via `RecordCapitalFundsIncome` | — |
| D9 | `addDailyExpense()` | **Corrigé Phase 4** — méthode supprimée (dead code, tests seulement) | — |
| D10 | Commission route commerciale | **Corrigé Phase 4** — `config.budget.commercialRouteFee` | — |
| D11 | Double activation partenaire | **Corrigé Phase 4** — `addCommercialRouteFee` retourne `{ skipped, reason }` ; UI bloque si duplicate | — |
| D12 | Ancien flux prêt | **Corrigé Phase 4** — `initLoanSystem()` supprimé (localStorage + `addIncome`) | — |
| D13 | `processLoanPayments` ×2 | **Corrigé Phase 4** — seul `BudgetProcessor` ; hook `onTurnEnd` retiré | — |
| D14 | Écritures informatives | **Corrigé Phase 4 slice 6** — `SyncTurnInformativeEntries` + `RecordBalanceSnapshot` / `RecordYearCumulEntries` / `RecordCarryForwardEntry` via BC | — |
| D15 | `addIncome()` / impôt citoyen | Confusion sémantique : tout crédit misc = impôt citoyen dans le journal | Slice typage revenus misc |

### Checklist write path

| Type opérationnel | BC Phase 3½ |
|---|---|
| maintenance, construction, salaires, impôt paie, impôt citoyen | ✅ |
| prêts (capital / intérêts / remboursement) | ✅ |
| commerce import / export | ✅ |
| `capital_funds`, `exceptional_expenses`, `commercial_route` | ✅ |
| `addIncome()` générique | ✅ Supprimé (throw) — D6/D15 |
| `addDailyExpense()` | ✅ Supprimé — D9 |
| `construction_refund` | ✅ `RecordConstructionRefundIncome` |
| `carry_forward`, `balance`, `cumul_*` | ✅ D14 — BC informative services |

---

## Phase 2b — livré ✅ (2026-07-31)

- `GetGeneralLedger` + `GeneralLedgerView` + filtres cohérents (J1, J2)
- `getGeneralLedger()` dans `acl/accounting.js` (J5)
- Presenter journal DOM-only ; plus d'écriture localStorage (J4)
- Export JSON/PDF via `acl/accounting.js` → composition root (plus de `window.journalManager` direct)
- Indication tri « plus récent en haut » (J3)

---

## Phase 3 — livré ✅ (2026-07-31)

| Query | Chemin |
|---|---|
| `GetIncomeStatement` | `application/queries/financial-statements/GetIncomeStatement.js` |
| `GetBalanceSheet` | `application/queries/financial-statements/GetBalanceSheet.js` |
| `CityAssetsValuationPort` | `infrastructure/adapters/shared/CityAssetsValuationAdapter.js` |

- ACL : `getIncomeStatement()`, `getBalanceSheet()`
- `#budget-panel` → `getBalanceSheet()` (`buttons.js`)
- `#budget-states-panel` résumé → `getIncomeStatement()` + snapshots `budget_turn_*` (historique tours)

---

## J6/J7 — idempotence salaires ✅ (2026-07-31)

| Fix | Fichier |
|---|---|
| `appendIfAbsent` atomique sur buffer | `SessionLedgerBuffer.js` |
| `RecordLedgerEntry` sans TOCTOU | `RecordLedgerEntry.js` |
| Mutex `processBudget` | `BudgetProcessor.js` |
| Clé civile `year:monthIndex` (alignée businessKey) | `BudgetProcessor.js` |
| Passage explicite `turn` aux écritures | `BudgetProcessor.js`, `BudgetManager.js` |
| `skipBudget: true` sur scene.update RandomEvents | `RandomEventsService.js` |

Tests : `salaryIdempotence.behavior.test.js`

---

## Phase 2b — archive

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

## Phase 3½ slice 1 — buffer session + flush batch (2026-07-30)

### Objectif

Réduire les écritures IndexedDB **sans perdre de données** : le buffer RAM est la source de vérité pendant la session ; IndexedDB reçoit un checkpoint par tour.

### Faisabilité (validée)

| Point | Décision | Risque data |
|---|---|---|
| Écritures opérationnelles (taxes, salaires, imports…) | Buffer → flush fin de `processBudget` | Aucune perte : buffer autoritaire ; flush échoué → entrées restent en RAM + retry visibility |
| Snapshots `balance` | Session-only (`persist: false`) | OK : exclus des agrégats ; trésorerie HUD via `budget.funds` |
| Trésorerie `budget.put` | **Inchangé** (immédiat) | Aucun |
| Reprise de partie | `ensureHydrated()` charge IDB une fois | Aucun |
| Export JSON/PDF | Lit le buffer (inclut balance session) | Aucun |
| BC lecture | `SessionJournalRepository` → `JournalManager` | Aligné buffer |

### Fichiers

| Rôle | Chemin |
|---|---|
| Buffer session | `src/js/stores/SessionLedgerBuffer.js` |
| Flush + hydrate | `src/js/stores/JournalManager.js` |
| Hook flush fin de tour | `src/js/game/managers/BudgetProcessor.js` |
| BC read adapter | `src/contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalRepository.js` |

### Prochaines slices 3½

- `RecordLedgerEntry` command BC
- Test property vitesse rapide

---

## P0.5 + businessKey (2026-07-30)

| Fix | Fichier |
|---|---|
| `updateTurn` en tête de `game.update` (balance/carry-forward même si pause mid-tick) | `game.js` |
| Idempotence `businessKey` (salary, payroll_tax, maintenance, citizen_tax, prêts) | `ledgerBusinessKeys.js`, `JournalManager.js`, `SessionLedgerBuffer.js` |

---

## P0 game loop — tick sérialisé (2026-07-30)

| Fix | Fichier |
|---|---|
| Suppression double `setInterval` | `game.js` → `GameLoop` unique |
| Tick async sérialisé (`tickInFlight`) | `engine/loop/GameLoop.js` |
| Pause : sortie anticipée + citoyens gelés | `game.js`, `scene.js` `draw()` |
| `processBudget` une fois / tour | `scene.update(_, _, { skipBudget })` + 2e passe seulement dans `game.update` |

---

## Phase 4 slice 7 — trésorerie BC seule (2026-07-31)

### Objectif

Finir le cycle refactor budget : **plus de dépendance legacy** sur le write path trésorerie (sauf UI inchangée via `window.budgetManager`).

### Livré

| Élément | Chemin |
|---|---|
| Mutations trésorerie pures | `infrastructure/adapters/persistence/dexie/treasuryBudgetRowMutations.js` |
| Normalisation row | `normalizeTreasuryBudgetRow.js` |
| Write adapter Dexie | `DexieTreasuryWriteAdapter.js` |
| Read/write row | `DexieTreasuryRepository.js` (étendu) |
| Lifecycle | `InitializeTreasury`, `ForceReinitializeTreasury`, `UpdateTreasuryTurn` |
| Queries | `GetTreasurySnapshot`, `GetFinancialHealth` |
| Portefeuille prêts | `TreasuryLoanPortfolio.js` |
| Composition root default | `DexieTreasuryWriteAdapter` (plus `LegacyTreasuryWriteAdapter`) |
| ACL | `getTreasurySnapshot`, `initializeTreasury`, `updateTreasuryTurn`, … |
| Façade UI | `BudgetManager` délègue au BC |
| Construction | `acl/budget.js` → BC direct |

### Régression legacy

`createLegacyAccountingContext({ budgetManager })` injecte `LegacyTreasuryRepository` + `LegacyTreasuryWriteAdapter`.

### Tests

`tests/contexts/accounting/dexieTreasuryWrite.parity.test.js` — 601+ tests verts.

---

## Références code

| Rôle | Chemin |
|---|---|
| Presenter journal (legacy) | `src/js/ui/journal/JournalManager.js` |
| Agrégats mensuels/annuels | `src/contexts/accounting/infrastructure/adapters/persistence/dexie/journalAggregations.js` |
| Écritures salaires / impôts | `src/js/game/managers/BudgetProcessor.js`, `BudgetManager.addSalaries` / `addSalaryTax` |
| Store journal (write + re-export) | `src/js/stores/JournalManager.js` |
| Spec BC | `src/contexts/accounting/README.md` |
