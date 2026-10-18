# Bug : lignes d'un lot sans identifiant, la trésorerie refuse de se lire

**Date :** 2026-10-18
**Contexte :** règlement du mois écrit en une seule transaction (`SessionJournalStore.batch`), branche `feature/transactions`
**Statut :** corrigé

---

## Symptômes observés

Au passage de mois (tour 5 dans le test), le jeu s'arrête avec :

```
[ProcessTurnBudget] budget operations failed at turn 5: [treasury] journal line public_wage (turn 5) has no id: it was never written
    at treasuryLinesInOrder (GetTreasurySnapshot.js)
    at Object.fundsOf (createAccountingContext.js)
    at SettleHouseRents.execute
```

## Cause racine

- Le règlement du mois est écrit en un bloc : ses lignes restent en mémoire et ne reçoivent leur identifiant que quand IndexedDB les écrit, à la fin du bloc.
- Pendant le règlement, `SettleHouseRents` lit la caisse d'une maison (`fundsOf`). Cette lecture passait par `GetTreasurySnapshot.execute`, qui ordonne les lignes par identifiant et refuse celles qui n'en ont pas (« jamais écrite »).
- Le tri du journal (`b.id - a.id`) était lui aussi faussé pour ces lignes.
- Chaque locataire provoquait en plus un parcours complet du journal.

## Correctif

- Une ligne tenue en mémoire reçoit un identifiant **provisoire** très au-dessus de ceux de la base (`PROVISIONAL_ID_BASE`, `SessionLedgerBuffer`) : elle se range après les lignes déjà écrites, dans l'ordre où elle a été tenue. À l'écriture, la base donne le vrai identifiant, qui conserve cet ordre (`toDexieRow` retire l'identifiant provisoire).
- Une première piste a été abandonnée : donner des identifiants réels depuis la mémoire provoque un `ConstraintError` quand des lignes existent en base sans que la mémoire les connaisse.
- Les lectures de caisse du règlement (`fundsOf`, `companyFundsOf`, `businessFundsOf`) lisent le solde du compte 512 dans le pli (`cashOf`), sans parcourir le journal.

## Test de non-régression

`tests/JournalManager.test.js` (bloc `batch`) : une ligne tenue dans un lot a déjà un identifiant, et à la fin du lot elles ont les identifiants de la base, dans l'ordre d'enregistrement.

## Leçon

Garder en mémoire des lignes « pas encore écrites » change ce que les lecteurs peuvent supposer d'elles. Vérifier tous les lecteurs qui s'appuient sur l'identifiant (tri, contrôle « jamais écrite ») avant d'introduire un lot.
