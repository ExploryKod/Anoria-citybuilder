# Bounded context : Intelligence (Information / News)

Phase 0 — spécification. **Phase 1 en cours d’implémentation** (news ville + modale event + archives admin).

Le BC **Intelligence** possède le **bulletin d’information** de la ville : génération de dépêches, droits d’accès (atouts), cycle de vie (incoming → archive, ou **delete** si non payé), et *demande* de paiement **à la dépêche**.

Il **ne possède pas** la comptabilité des paiements : le poste budgétaire **Contributions** appartient à **Accounting**. Voir [`docs/boundaries.md`](docs/boundaries.md).

---

## Décisions validées (Phase 0)

1. **Nouveau BC** `intelligence` — distinct de Commerce, Gameplay, Accounting, Housing.
2. **News = information** ; **Event = effet monde** (Gameplay). Un conseiller peut *annoncer* sans *appliquer*.
3. **Contributions** : paiement ponctuel par dépêche ; **Payer** → révélé puis archive ; **Lire d’autres nouvelles** → **suppression** définitive. Hint fonds sous Payer.
4. **UX** : **`NewsEventModal`** = file event only (**Lire le suivant** toujours) ; **archives** = nouvel onglet du **panneau admin**.
5. **Espions / diplomates** : catalogue `planned`, hors MVP.
6. **Innovations savants** (`scholar_idea`) : stub ; déblocage plus tard.

---

## Documents

| Fichier | Contenu |
|---------|---------|
| [`docs/gameplay.plan.md`](docs/gameplay.plan.md) | Sources, gates, paiement, UX modale/archives, phasage |
| [`docs/boundaries.md`](docs/boundaries.md) | Frontières DDD, Accounting ↔ Intelligence |

---

## Ubiquitous language (aperçu)

| Terme FR | Terme code (cible) | Définition |
|----------|-------------------|------------|
| **Dépêche** | `NewsItem` | Unité d’information datée (`turn`), typée source + catégorie |
| **Incoming** | `lifecycle: incoming` | Dans la file de la modale event |
| **Archive** | `lifecycle: archived` | Consultable dans l’onglet Archives **admin** |
| **Suppression** | delete | Non payé → disparu définitivement |
| **Révélation** | `revelation` | `free` / `unpaid` / `revealed` |
| **Contribution** | *(Accounting)* `journal.type = contribution` | Charge pour **une** dépêche |
| **Modale event** | `NewsEventModal` | Event bloquant ; articles de la file uniquement |

---

## Statut

| Phase | Statut |
|-------|--------|
| 0 — Spec | Fait |
| 1 — Modale event + news ville + onglet Archives admin | Fait |
| 2 — Caravane + payer / delete | **En cours** |
| 3 — Conseillers | Non démarré |
| 4+ — Espions / innovations | Reporté |
