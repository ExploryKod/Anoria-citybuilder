# Intelligence — DDD boundaries

Intelligence est **downstream** des faits ville (Housing, Employment, Commerce, Supply) et **collaborateur** d’Accounting pour le **paiement ponctuel d’une dépêche** — sans posséder la comptabilité.


---

## 1. Carte des responsabilités

```
┌─────────────┐  signaux RO     ┌──────────────────┐
│ Housing     │ ───────────────►│                  │
│ Employment  │ ───────────────►│   INTELLIGENCE   │──► NewsItem / Bulletin
│ Commerce    │ ───────────────►│                  │
│ Supply      │ ───────────────►│                  │
└─────────────┘                 └────────┬─────────┘
                                         │ SettleContribution(newsItemId)
                                         ▼
                                ┌──────────────────┐
                                │   ACCOUNTING     │──► journal type=contribution
                                │                  │──► trésorerie / CR / livret
                                └──────────────────┘
```

Gameplay reste sur la voie **effets** (désastres, RNG appliqués). Intelligence peut *référencer* un `eventId` dans `payload` sans l’exécuter.

---

## 2. Ce que Intelligence possède

| Artefact | Notes |
|----------|-------|
| `NewsItem` + historique bulletin | Persisté dans le repo Intelligence |
| Catalogues `NewsSource` / `NewsCategory` | Inclut sources `planned` |
| Policies d’accès (`CaravanNewsAccessPolicy`, …) | Atouts + révélation payante à la dépêche |
| `SettleContribution` (intention sortante) | **Par `newsItemId`**, pas abonnement mensuel |
| Cycle de vie incoming → archived (ou delete) | + `MarkNewsRead` / purge |



## 3. Ce que Intelligence ne possède pas

| Artefact | Owner |
|----------|-------|
| Solde, journal, CR, bilan, livret | Accounting |
| Type d’écriture `contribution` + labels UI compta | Accounting |
| Stocks barn, routes, quotas | Supply / Commerce |
| `pop`, famine, chômage | Housing / Employment |
| Application d’un désastre | Gameplay |

---

## 4. Frontière critique : Contributions (à la dépêche)

### 4.1 Pourquoi rester prudent

Les contributions **ressemblent** à de la compta (poste budgétaire, 10 €, journal) **et** à de l’intelligence (sans paiement → pas de contenu).  
Risque : coller tout dans Accounting (textes news) ou tout dans Intelligence (second budget).

### 4.2 Règle de découpage

| Question | Répondant |
|----------|-----------|
| Combien ? quel `type` journal ? quel `businessKey` ? | **Accounting** |
| Cette dépêche a-t-elle un prix / atouts ? | **Intelligence** |
| Le joueur paie-t-il **cette** `newsItemId` maintenant ? | **Intelligence** (CTA modale) → `settle` |
| Le paiement a-t-il réussi ? | **Accounting** |
| `revelation` / archived / delete | **Intelligence** |


**Pas d’abonnement mensuel.** Idempotence = une écriture max par `newsItemId`.

### 4.3 Ports (contrat cible)

**Sortant Intelligence → Accounting**

```
SettleContributionPort.settle({
  newsItemId: string,
  channelId: 'caravan',      // libellé / analytique
  amount: 10,
  turn: number,
  businessKey: string,       // contribution:news:{newsItemId}
  description: string,
}) → { ok: true, entryId } | { ok: false, reason: 'insufficient_funds' | 'already_settled' | … }
```

**Entrant Intelligence ← Accounting**

```
ContributionStatusPort.canAfford(amount) → boolean   // hint UI sous « Payer »
ContributionStatusPort.wasPaidForNews(newsItemId) → boolean  // optionnel si Intelligence garde revelation
```

### 4.4 Interdits

- Pas de table « abonnements news » dans Accounting.
- Intelligence n’écrit pas `db.journal` ; Accounting n’importe pas le domain Intelligence.
- Pas de type journal `news_*` pour les lectures (hors mouvement d’argent).

---

## 5. Autres BCs — lecture seule

| BC | Faits lus (exemples) | Intelligence n’écrit pas |
|----|----------------------|---------------------------|
| Housing | `famished`, pop | stocks / pop |
| Employment | chômage, lack | `employees` |
| Commerce | routes ouvertes, `partnerId` | toggles trade |
| Supply | présence barn / stocks hub | transferts |
| Construction / Parcels | existence bâtiment | placement |
| Gameplay | catalogue désastres (pour annonces) | déclenchement effet |

Adapters : `infrastructure/adapters/...Port` dans Intelligence, branchés au composition root — **pas** d’import domain cross-BC.

---

## 6. Presentation

| Couche | Rôle |
|--------|------|
| `NewsEventModal` | File event only ; **Lire le suivant** ; unpaid : **Payer** (+ hint fonds) / **Lire d’autres nouvelles** (delete) |
| Onglet **Archives** (panneau admin) | Liste des `archived` (date `turn`) — hors modale |
| `PopupManager` | `shouldBlockEvents: true` pour les events |
| Labels journal « Contribution » | Accounting presentation |

---

## 7. Tests de contrat (cible Phase 2)

1. Barn + accord → event caravane `unpaid` ; **Payer** OK → `revealed` + écriture `contribution:news:{id}` ; **Lire le suivant** → `archived` (visible admin).
2. **Lire d’autres nouvelles** → item **supprimé** ; pas d’écriture ; absent des archives ; enchaîne la file.
3. Fonds insuffisants → hint **Fonds insuffisants** ; **Payer** inactif ; reste `unpaid` jusqu’au skip.
4. Fonds OK → hint **Vous avez les fonds** ; **Payer** actif.
5. Sans barn → pas d’event caravane.
6. Double `settle` même `newsItemId` → une seule écriture.
7. Archives admin : uniquement `archived` ; jamais les items deleted.

Voir aussi : [`gameplay.plan.md`](gameplay.plan.md).
