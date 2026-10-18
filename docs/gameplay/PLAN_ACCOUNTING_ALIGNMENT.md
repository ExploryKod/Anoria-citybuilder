# Plan : aligner la comptabilité du jeu sur la vraie comptabilité

Le jeu peut servir à apprendre la comptabilité : il doit donc en suivre la structure (journal, grand livre, balance, bilan, compte de résultat), pas seulement en reprendre les comptes.

## 1. Où nous en sommes (fin de la phase 1)

**Fait**
- Journal en PCG : chaque type de ligne a son compte (`PcgJournalCatalog`).
- Compte de résultat par entreprise (`incomeStatementOf`) et ratios.
- Bilan dérivé d'une entreprise (`BalanceSheetPolicy`) : trésorerie, stock valorisé au coût, immobilisations, capital, emprunts, résultat cumulé. Il lit le journal, ne stocke rien, et lève une erreur s'il n'équilibre pas.
- Propriété : la SCI de la maison-mairie possède tous les bâtiments.
  - L'exploitant d'un bâtiment (entreprise, service) paie à la SCI un loyer égal à l'entretien (+ marge de la SCI, 0 aujourd'hui) : `premises_rent_paid` (6132) chez lui, `premises_rent_received` (752) et `maintenance` chez la SCI.
  - Une coopérative de maison loue le local de son activité : `premisesShare` (0,3, première valeur) de l'entretien de la maison, déclaré au catalogue. Le loyer des ménages prend le reste. Ce loyer n'est pas plafonné par l'encadrement des loyers.
  - Un bâtiment sans exploitant est loué par le hameau, sur la ligne « Entretien » de son livret.
  - La construction est payée par la ville ; le bilan de la SCI en déduit l'immobilisation (213, coût de construction net des remboursements) et l'apport en nature de la ville (101).
  - Sans propriétaire (maison-mairie démolie), les exploitants reprennent leur entretien.
  - Un loyer de local que la coopérative ne peut pas payer est une ligne informative (`info_premises_rent_due`), pas une dette reportée.

**Ce qui sépare encore le jeu du réel**
- Le journal est une liste de mouvements d'argent à une seule jambe. Une écriture réelle a un débit et un crédit de même montant.
- Pas de grand livre (les écritures par compte), pas de balance (la somme par compte, dont le total débit égale le total crédit).
- Pas d'écritures sans argent : amortissement, variation de stock, charges à payer.
- Tout est payé au comptant : pas de créances (411) ni de dettes (401).
- Le bilan est celui d'aujourd'hui : les quantités en stock ne sont pas historisées, un bilan passé est impossible.

## 2. Trois façons d'y arriver

1. **Double entrée partout.** Chaque ligne devient une écriture avec ses deux comptes. C'est le plus fidèle, mais il faut réécrire une quarantaine de types de lignes et toute l'idempotence.
2. **Postings dérivés.** Le catalogue PCG donne, pour chaque type de ligne, le compte débité et le compte crédité. Une fonction pure produit les postings de chaque ligne ; le grand livre et la balance se calculent à partir d'eux, sans écrire de nouvelle donnée.
3. **Hybride** (cible) : l'option 2, plus des écritures d'opérations diverses (OD) pour ce qui n'a pas d'argent, écrites une fois par mois et par entreprise.

## 3. Étapes

### Étape 0 — De vraies écritures en partie double (DÉCIDÉE, À FAIRE, avant les étapes 4b et 5)

**Décision** : le jeu suit le PCG comme un vrai système en partie double (option 1), au lieu des postings dérivés d'une ligne à une jambe (option 2, étapes 1 à 4a). Les règles correspondantes de `CLAUDE.md` sont réécrites : « Money: one flow », « Purge closes a year », « The journal holds écritures only », « The balance sheet is derived », « One balance ». Les étapes 1 à 4a restent vraies comme lectures (grand livre, balance, bilan, dettes) ; leur source change.

**Pourquoi** : une ligne à une jambe force `postingsOf` à deviner l'autre compte (la banque implicite, le `counter`), et elle donne à un type un seul point de vue (celui du payeur). Un impôt, une cotisation, un loyer sont deux écritures vues de deux acteurs : avec des écritures à deux jambes nommées, la ville, la SCI, l'entreprise et le ménage lisent chacun leurs comptes sans règle d'exception, et la consolidation n'est plus un cas à part.

**La forme d'une écriture** : un code journal (`BQ`, `VT`, `AC`, `PA`, `OD`, `AN`), un tour (année et mois posés à l'écriture), un compte propriétaire (l'acteur) et au moins deux jambes `{ compte, débit, crédit }` en centimes, équilibrées. L'écriture déséquilibrée est refusée à l'écriture, avec son type. La trésorerie est le solde des comptes de caisse (512, 53) : plus de `moneyDirectionOf`. `PcgJournalCatalog` déclare, par type d'écriture, ses jambes (comptes et sens) et son code journal ; c'est l'écrivain qui nomme les comptes, rien n'est deviné après coup.

**Clôture et purge** : la clôture de l'exercice est faite d'écritures ordinaires (classes 6 et 7 soldées contre 12, affectation du résultat en 110/119 et dividendes), la réouverture d'à-nouveaux (journal `AN`, une écriture équilibrée par compte de bilan). `year_closing` disparaît comme ligne de totaux : il ne reste qu'un `summary` en lecture seule (totaux par type, coût de chaque bâtiment). La purge remplace les écritures des années abandonnées par ces écritures de clôture et d'à-nouveaux ; elle ne change ni la trésorerie ni le bilan.

**Lecture et performance** : un seul pli (« fold ») du journal en mémoire, jamais stocké : `Map<acteur, année/mois → compte → { débit, crédit }>` en centimes, mis à jour en ne repliant que les nouvelles écritures (le journal ne fait qu'ajouter), reconstruit au chargement et après une purge. La trésorerie, la balance, le compte de résultat, le bilan et le livret de la ville en sont des sommes ; un bâtiment est une recherche, un hameau un filtre, la ville la somme des hameaux. Le détail du grand livre vient d'un index `acteur → écritures`. Le pli ne tourne jamais dans le chemin chaud d'un tour.

**Travail** (une réécriture d'un bloc, sans chemin de compatibilité, selon « No saved games to migrate »)
1. `JournalEntry` et son écriture : jambes nommées, refus du déséquilibre, codes journal ; `PcgJournalCatalog` réécrit en jambes par type.
2. Les services `Record*`, `Settle*`, `CloseMonthAccounts`, `FundNewCompanies` écrivent des écritures à deux jambes ; les OD deviennent le code `OD`.
3. Le pli et son cache ; `GetTreasurySnapshot`, `AccountLedgerPolicy`, `BalanceSheetPolicy`, `DebtPolicy` le lisent.
4. Clôture et à-nouveaux à la place de `year_closing` ; la purge.
5. Le prefab `anoria-tour-116` : son journal est réécrit en écritures à deux jambes (JSON direct).
6. Tests de non-régression : une écriture déséquilibrée est refusée ; la purge laisse la trésorerie et le bilan identiques ; la trésorerie de la ville est la somme de celles des hameaux ; le bilan équilibre.

**Question restante (à vérifier en codant)** : un flux entre deux acteurs (un impôt, un loyer) est aujourd'hui peut-être deux lignes, une par compte. Avec des écritures, chaque acteur écrit la sienne, ou une écriture unique porte les jambes des deux acteurs ; le choix décide de la consolidation (étape 5) : à trancher avant d'écrire le catalogue.

### Étape 1 — Postings dérivés : Journal, Grand livre, Balance (FAIT)

Réalisé : `AccountLedgerPolicy.js` (`postingsOf`, `accountLedgerOf`, `trialBalanceOf`), `getBuildingLedger`, pastilles « Grand livre » et « Balance » de l'onglet Finances d'une entreprise, test `accountLedger.test.js`. Comme chaque ligne du journal est une seule jambe d'argent, la banque est toujours l'autre jambe : le catalogue n'a gagné qu'un champ `counter`, pour les dépôts et retraits (275 côté déposant, 165 côté banque, 768 pour l'intérêt d'un ménage). La balance équilibre par construction : la vérification utile est le rapprochement du solde de 512 avec la trésorerie, qui lève une erreur au moindre écart. Elle ne deviendra non triviale qu'avec les OD de l'étape 2.

Prévu à l'origine :
- Étendre `PcgJournalCatalog` : chaque type déclare `debit` et `credit` (comptes). Un type sans posting lève une erreur.
- Fonction pure `postingsOf(entry)` → liste de `{ account, debit, credit }`.
- Grand livre : postings regroupés par compte, par acteur (entreprise, hameau). Balance : soldes débiteurs et créditeurs par compte.
- Contrôle : le total des débits égale celui des crédits. Un écart nomme la ligne ou le type mal classé.
- Le compte 512 (banque) devient le solde de la trésorerie : `moneyDirectionOf` et la balance doivent s'accorder (règle « un seul solde »).
- Présentation : trois lectures du compte, Journal, Grand livre, Balance, à côté du compte de résultat et du bilan.
- Aucune écriture de plus, aucune migration. Test de non-régression : la balance équilibre sur un journal d'exemple et un type sans compte lève une erreur.

### Étape 2 — Clôture mensuelle : variation de stock, amortissement (FAIT)

Réalisé : règle du journal réécrite dans `CLAUDE.md` (mouvements de valeur : argent ou OD) ; OD déclarées dans `PcgJournalCatalog` (`od_stock_up|down_merchandise|production`, `od_depreciation`) ; `CloseMonthAccounts` écrit une fois par compte et par mois, après le règlement du mois (`ProcessTurnBudget`) ; `MonthClosingPolicy` ; `DEPRECIATION_YEARS` (maisons 30 ans, fermes et marchés 20, industrie 25 : premières valeurs) ; le compte de résultat gagne « Variation de stock », « Production stockée » et « Dotations aux amortissements » (la CAF ajoute l'amortissement, la valeur ajoutée tient compte du stock) ; grand livre et balance incluent les OD ; le bilan lit les OD (amortissements 281, variation de stock en cours = stock du moment moins stock déjà posté). Test : `monthClosing.test.js`.
Limites connues : une purge d'année replie les OD sans les garder (le stock posté et l'amortissement cumulé repartent de zéro, l'équilibre reste mais l'historique est perdu : étape 3) ; (la sortie d'actif d'un bâtiment démoli est faite, voir plus bas) ; le bilan d'un mois passé n'est pas encore proposé (les OD le permettent, la vue ne le fait pas).

Prévu à l'origine :
- Inventaire **intermittent** : on ne passe pas le stock en inventaire permanent (une écriture par livraison serait lourde). À la clôture du mois, une OD porte la variation de stock (603 / 71) et conserve la valeur du stock en fin de mois : le bilan d'un mois passé devient possible.
- Amortissement des constructions de la SCI : durée par type de bâtiment déclarée au catalogue, dotation mensuelle (681) en OD, amortissement cumulé (281) au bilan.
- Écrites une fois par entreprise et par mois, en un seul `bulkAdd` dans une transaction avec le reste du règlement mensuel.
- **Règle à changer dans `CLAUDE.md`** : « le journal ne contient que des mouvements d'argent » devient « tout mouvement de valeur » ; une OD ne bouge pas l'argent (`moneyDirectionOf` renvoie null) mais a ses postings. À rédiger avant de coder.

### Étape 3 — Clôture annuelle compatible avec la purge (FAIT)

Réalisé : `year_closing` porte désormais, en plus du flux net et des totaux par type (qui incluent les OD), les **soldes des comptes de bilan** (`balances`, débit moins crédit), le **résultat** de l'année et le **coût de construction** de chaque bâtiment (`constructions`, nécessaire à l'actif et à l'amortissement de la SCI). Le grand livre poste ces à-nouveaux contre le compte 12 ; le bilan les relit (capital, emprunts, immobilisations, amortissements, stock posté, résultat) : une purge ne change ni la trésorerie ni le bilan. L'affectation du résultat est dérivée, rien n'est écrit : le bilan sépare « Report à nouveau » (les années passées) de « Résultat de l'exercice » (l'année en cours) ; les dividendes restent les lignes `enterprise_dividend` déjà écrites à la clôture de l'exercice. Le compte de résultat d'une année purgée se lit désormais depuis ses totaux (il restait vide). Tests : `balanceSheet.test.js` (la purge laisse le bilan identique), `accountLedger.test.js`.
Limites : une clôture écrite avant cette étape (sans `balances`) lève une erreur au lieu d'être lue (pas de migration) ; la répartition des à-nouveaux n'a qu'un compte « 12 » (résultat reporté), pas de distinction 110/119 .

### Sortie d'actif d'un bâtiment démoli (FAIT)

La SCI survit à la démolition : elle doit sortir le bâtiment de ses livres, comme dans le réel. La clôture du mois écrit, bâtiment par bâtiment, des OD (`od_asset_contribution` : 213 contre le capital 101 quand un bâtiment entre ; `od_asset_disposal_amortization` : 281 soldé ; `od_asset_disposal_loss` : valeur nette en charge 675 quand il sort). Le capital reste ce que la ville a apporté : la perte passe dans le résultat, le capital ne baisse pas. Ce que les livres portent par bâtiment (`postedAssetsOf`) se lit dans les OD et dans les à-nouveaux des années purgées (`closing.assets`) ; le type d'un bâtiment démoli se lit sur sa ligne de construction (`Building: <type>`), gardé dans la clôture. Cette lecture remplace le calcul « apport = coût des bâtiments en place » du bilan : l'actif, le capital, l'amortissement et la perte sont désormais des écritures, donc visibles au grand livre et à la balance de la SCI. Les routes restent à la ville (ni apport, ni loyer, ni amortissement). L'amortissement soldé suit la formule jusqu'à la clôture précédente (pas de dotation du mois de la démolition). Test : `monthClosing.test.js`.

Prévu à l'origine :
- Affectation du résultat : report à nouveau (110 / 119), dividendes (457).
- `year_closing` garde aujourd'hui le flux net de l'année. Avec un bilan, il doit conserver les **soldes des comptes de bilan** (à-nouveaux : capital, immobilisations, stock, emprunts), sinon la purge détruit les capitaux et les stocks. C'est le point le plus délicat à ne pas rater. La règle « la purge ne change jamais la trésorerie » reste vraie.

### Étape 4 — Créances et dettes (en dernier)

Plan détaillé, avec la faillite : `docs/gameplay/PLAN_BANKRUPTCY_PAYABLES.md` (4a dettes d'exploitation impayées, FAIT, avec un capital de départ versé par la ville aux entreprises ; 4b liquidation et fin de partie, à faire ; garantie des salaires par la ville, 3 mois de grâce, liquidation automatique). Le crédit commercial entre entreprises reste hors de cette étape.

Prévu à l'origine :
- Séparer la facture du paiement : clients (411), fournisseurs (401), TVA collectée (4457) et déductible.
- C'est un changement de règle de jeu : retards de paiement, impayés, faillite possible. Les loyers impayés en sont le précédent.
- À ne faire que lorsque le jeu aura besoin du crédit entre acteurs.

### Étape 5 — Hameau et ville : bilan et consolidation
- Comptabilité publique pour le hameau (sans stock ni capital) : excédent ou déficit, immobilisations publiques, emprunts.
- Ville = somme des hameaux, avec élimination des flux internes (une ligne est un produit d'un côté, une charge de l'autre). Chaque acteur calcule ses postings à partir de la même ligne ; sinon la consolidation compte deux fois.
- Particulier : un patrimoine (dépôt, dettes), pas de bilan PCG.

## 4. Performance et IndexedDB

- **Volume.** Les régularisations se font à la clôture mensuelle, pas à chaque tour : environ 50 bâtiments × 3 écritures par mois, soit environ 150 lignes par mois. C'est négligeable face à la traçabilité de l'approvisionnement, qui écrit à chaque transfert.
- **Regroupement des écritures.** Chaque ligne du règlement est écrite à part aujourd'hui. Un règlement mensuel groupé en un seul `bulkAdd` dans une transaction est le gain principal.
- **Lecture.** Le bilan et le grand livre relisent tout le journal à chaque ouverture. Prévoir un cache en mémoire reconstruit au chargement, jamais stocké dans la base, et un index par compte : le journal reste le seul enregistrement, conformément à « jamais de chiffre dérivé stocké ».
- **Durée d'un mois.** Les écritures mensuelles dépendent de `getDaysPerMonth()` ; rien n'est écrit en dur.

## 5. Limites et arbitrages

- **Fidélité contre complexité.** La double entrée complète (option 1) est la plus fidèle mais coûte le plus. Les postings dérivés donnent la balance et le grand livre sans rien réécrire ; les OD ajoutent seulement ce qui n'a pas d'argent.
- **Inventaire intermittent contre permanent.** L'intermittent est celui des petites structures, léger et pédagogique ; le permanent suivrait chaque livraison.
- **Pas tout le PCG.** Le jeu n'implémente que les comptes qu'il fait vivre.
- **Pas de rétroactivité.** Aucune migration de partie existante : un journal sans postings ou sans OD lève une erreur.

## 6. Ordre et décision

1. Étapes 1 à 3 et 4a : faites sur le modèle à une jambe.
2. Étape 0 : les règles de `CLAUDE.md` sont réécrites (fait) ; le code suit en un bloc.
3. Étape 5 (le livret et le bilan de la ville lisent le même pli), puis 4b (la liquidation écrit chez la ville et la SCI : perte sur créance, fonds de garantie).

Prochain pas : trancher la question restante de l'étape 0 (une écriture par acteur ou une écriture commune), puis réécrire le catalogue.
