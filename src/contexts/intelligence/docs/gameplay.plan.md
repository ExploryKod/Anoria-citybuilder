# Plan gameplay — Intelligence (bounded context)

Document de conception Phase 0. Aucune policy listée ici n’est encore implémentée.

Référence UX : **événements César III / Pharaon** — une dépêche arrive comme une **modale event-message bloquante** (pause). Archives consultables dans un **onglet du panneau administrateur**. Droits d’accès par source en plus du modèle César.

---

## 1. Principes directeurs

| Principe | Description |
|----------|-------------|
| **Information ≠ effet** | Une dépêche informe. Les effets monde (catastrophe, bonus, unlock tech) restent dans **Gameplay** / futurs BCs. |
| **Accès par atouts** | Certaines sources sont invisibles ou verrouillées sans bâtiments / accords / rôles. |
| **Contribution ≠ news** | Payer une contribution est une **écriture comptable ponctuelle** (Accounting), liée à une `newsItemId`. Pas d’abonnement. |
| **Signaux en lecture seule** | Intelligence lit Housing / Employment / Commerce / Supply via ports ; elle ne mute pas leurs agrégats. |
| **Catalogue ouvert** | Sources futures (espion, diplomate) existent dans le catalogue en `status: planned`. |

---

## 2. Sources et catégories

### 2.1 Catalogue des sources

| `sourceId` | Libellé FR | MVP | Notes |
|------------|------------|-----|-------|
| `city` | Ville (interne) | Oui | Plaintes, révélations, idées de savants |
| `caravan` | Commerçants de passage | Oui (phase 2) | News internationales via barn + accord |
| `advisor` | Conseillers | Oui (phase 3) | Aléas annoncés, conseils, rapports de rôle |
| `spy` | Espions | **Plus tard** | Stub catalogue uniquement |
| `diplomat` | Diplomates étrangers | **Plus tard** | Stub catalogue uniquement |

### 2.2 Catégories par source

#### Ville (`city`)

| `categoryId` | Libellé | Rôle joueur |
|--------------|---------|-------------|
| `complaint` | Plainte | Parfois de mauvaise foi, parfois réelle — croiser avec d’autres indicateurs |
| `revelation` | Révélation | Plus utile : ressource cachée, événement imminent, fait factuel |
| `scholar_idea` | Idée de savant | Stub MVP : affichage seulement ; innovations **plus tard** |

#### Caravane (`caravan`)

| `categoryId` | Libellé | Exemples (cible) |
|--------------|---------|------------------|
| `trade_rumor` | Rumeur commerciale | Prix, pénurie chez un partenaire |
| `partner_news` | Nouvelle partenaire | Ouverture / tension politique (flavour + hooks futurs) |
| `foreign_market` | Marché extérieur | Opportunité d’import/export (info, pas auto-trade) |

#### Conseiller (`advisor`)

| `categoryId` | Libellé | Notes |
|--------------|---------|-------|
| `random_event` | Événement aléatoire | Annonce ; l’effet éventuel = Gameplay |
| `advice` | Conseil | Texte conditionnel (ex. chômage élevé) |
| `situation_report` | Rapport de situation | Selon `advisorRole` : finance, santé, travail, commerce… |

#### Espion / diplomate

Catégories à définir en phase dédiée (`spy_report`, `diplomatic_note`, …). **Ne pas implémenter.**

---

## 3. Modèle `NewsItem` (cible)

```
NewsItem {
  id: string                 // uuid
  turn: number               // tour d’annonce (date — conservée en archive admin)
  announcedAtIso?: string    // optionnel : horodatage session pour archive UI
  sourceId: NewsSourceId
  categoryId: NewsCategoryId
  advisorRole?: AdvisorRole  // si source = advisor
  title: string
  body: string               // texte plein ; masqué tant que non révélé si paywall
  teaser?: string            // aperçu non payant sur la modale event
  reliability?: 'trusted' | 'uncertain' | 'biased'  // plaintes
  payload?: object           // révélation : hint ressource / eventId…
  access: {
    requiresAssets: AssetGate[]
    price?: number           // contribution à la dépêche (ex. 10) ; absent = gratuit
  }
  lifecycle: 'incoming' | 'archived'
  revelation: 'free' | 'unpaid' | 'revealed'
  readAtTurn?: number | null
}
```

| Champ | Sens |
|-------|------|
| `incoming` | Dans la file event ; pas encore archivé |
| `archived` | Persisté ; consultable dans l’**onglet Archives du panneau admin** |
| *(supprimé)* | Non payé → **delete** définitif (plus jamais accessible, pas de trace archive) |
| `revelation: unpaid` | Event : teaser + CTA payer / skip |
| `revelation: revealed` | Corps accessible (modale puis archive) |
| `revelation: free` | Pas de paywall |

**Décision caravane** : atouts OK → event `unpaid` + `price: 10` ; payer → `revealed` puis archive ; **Lire d’autres nouvelles** → **suppression** de l’item. Sans atouts → pas d’event.

---

## 4. Gates d’accès (policies)

### 4.1 Caravane — `CaravanNewsAccessPolicy`

Pour qu’une dépêche `caravan` **déclenche un event** au tour T :

1. **Atout barn** — au moins une grange commerce (`Barn-001`) construite et opérationnelle.
2. **Atout accord** — au moins une route commerciale ouverte avec un partenaire.

Sur la **modale event-message** :

| Choix joueur | Effet |
|--------------|--------|
| **Payer** (10 €) | `SettleContribution` → `revealed` → lecture → **Lire le suivant** → `archived` |
| **Lire d’autres nouvelles** | **Delete** l’item → **jamais** accessible → enchaîne la file |

Pas d’abonnement. Paiement = **à la dépêche**.

**Montant MVP** : **10 €** par dépêche caravane.

### 4.2 Ville — `CityNewsAccessPolicy`

- MVP : `revelation: free` ; event puis **Lire le suivant** → `archived`.

### 4.3 Conseiller — `AdvisorNewsAccessPolicy`

- MVP phase 3 : selon rôle / atouts UI ; gratuit par défaut.

### 4.4 Espion — `SpyNewsAccessPolicy`

- Pas d’event tant que `source.status === 'planned'`.

---

## 5. Contributions — paiement à la dépêche (pas d’abonnement)

### 5.1 Décision validée

- **Pas** d’abonnement mensuel.
- Paiement ponctuel lié à une `NewsItem` sur la modale event.
- Payer → révèle puis archive admin.
- Ne pas payer (**Lire d’autres nouvelles**) → **suppression** définitive.

### 5.2 Qui possède quoi

| Concept | Owner | Contenu |
|---------|-------|---------|
| Poste budgétaire / type journal `contribution` | **Accounting** | Écriture, trésorerie, CR, livret, labels |
| Prix + éligibilité atouts | **Intelligence** | Catalogue / policy |
| Intention « payer pour newsId » | **Intelligence → port** | `SettleContribution { newsItemId, amount, … }` |
| Exécution du débit + idempotence | **Accounting** | `businessKey` `contribution:news:{newsItemId}` |
| `revelation` / archive / delete | **Intelligence** | Après succès / skip joueur |

### 5.3 Flux (event payant)

```
Tour T — génération caravane (barn + accord)
  → NewsItem { revelation: unpaid, price: 10, lifecycle: incoming }
  → enqueue NewsEventModal (pause)

Sur la modale (uniquement les articles de la file event) :
  [Payer 10 €] + hint fonds (canAfford)
    → settle OK : revealed ; corps ; [Lire le suivant] → archived (admin)
    → fonds insuffisants : Payer inactif ; hint « Fonds insuffisants »
  [Lire d’autres nouvelles] (toujours)
    → delete NewsItem ; enchaîner file ou fermer si dernière
```

### 5.4 Ce qu’Intelligence / Accounting ne font pas

Pas d’écriture journal côté Intelligence ; pas de textes news côté Accounting ; **pas** d’abonnements.

---

## 6. Génération de contenu (cible)

### 6.1 Entrées (signaux en lecture)

| Signal | Port / BC | Usage |
|--------|-----------|-------|
| Population, affamés | Housing | Plaintes / révélations famine |
| Chômage, lack | Employment | Plaintes emploi, conseils |
| Routes ouvertes, partenaires | Commerce | Éligibilité caravane + rumours |
| Présence barn | Supply / Construction | Gate caravane |
| Fonds / tendance | Accounting (lecture) | Rapports conseiller finance |
| RNG seed tour | Shared / Gameplay | Conseils aléatoires, rumours |

### 6.2 Volume MVP (indicatif)

| Source | Par mois (ordre de grandeur) |
|--------|------------------------------|
| Ville | 0–2 dépêches |
| Caravane | 0–1 si éligible |
| Conseiller | 0–1 rapport ou conseil |

Éviter le spam : priorité `revelation` > `complaint` si quota saturé.

### 6.3 Fiabilité des plaintes

`reliability` :

| Valeur | Sens |
|--------|------|
| `trusted` | Alignée avec un signal réel (ex. famine > 0) |
| `uncertain` | Signal faible / bruité |
| `biased` | Contredit les agrégats (mauvaise foi) |

Le joueur doit croiser ; le jeu **ne met pas** un badge « mensonge » évident en MVP (option tooltip discret plus tard).

---

## 7. UX — modale event-message + archives admin

### 7.1 Séparation claire

| Surface | Rôle |
|---------|------|
| **`NewsEventModal`** | **Uniquement** les dépêches de la file event (incoming). Pause. Pas d’archives. |
| **Onglet Archives** (panneau **administrateur**) | Consultation des messages déjà traités et archivés (`lifecycle: archived`), avec date (`turn`). |

Le programme archive automatiquement après **Lire le suivant** (contenu lu / révélé). La modale n’affiche que l’article courant lié à l’event.

### 7.2 Modale event-message

```
┌─ Event message ────────────────────────────────────┐
│ Source / catégorie · tour                          │
│ Titre / teaser (+ corps si free ou revealed)       │
│                                                    │
│ ── si unpaid (contribution) ─────────────────────  │
│ [ Payer 10 € ]     [ Lire d’autres nouvelles ]     │
│  Vous avez les fonds  |  Fonds insuffisants        │
│                                                    │
│ ── toujours (après lecture / révélation, ou free) ─│
│ [ Lire le suivant ]                                │
└────────────────────────────────────────────────────┘
```

Règles :

- Contenu de la modale = **seulement** les items de la file event (pas l’historique admin).
- CTA d’enchaînement : **toujours** libellé **Lire le suivant** (y compris le dernier : archive + ferme + `playGame` si file vide).
- **unpaid** : **Payer** (+ hint fonds) et **Lire d’autres nouvelles** à côté.
- **Lire d’autres nouvelles** → **delete** définitif → item suivant (ou fermeture).
- **Payer** OK → `revealed` → corps visible → joueur enchaîne avec **Lire le suivant** → `archived`.
- Fonds insuffisants → hint **Fonds insuffisants** ; Payer inactif ; skip uniquement via **Lire d’autres nouvelles**.

### 7.3 Archives (panneau admin)

- Nouvel **onglet** du panneau administrateur (pas dans la modale event, pas de bouton Info dédié pour ça).
- Liste des `NewsItem` `archived` uniquement (payés / gratuits lus).
- Date d’event conservée (`turn`).
- Chaque entrée : bouton **poubelle** → `deleteNewsItem` (suppression définitive).
- Items non payés : **absents** (supprimés à l’event).

### 7.4 Presentation / shell

- Popup bloquante (`shouldBlockEvents: true`) pour `NewsEventModal`.
- Owner archives UI : présentation admin (hors domain Intelligence).

---

## 8. Structure code cible

```
src/contexts/intelligence/
  README.md
  docs/
    gameplay.plan.md      ← ce fichier
    boundaries.md
  domain/                 ← Phase 1+
    catalogs/
    policies/
  application/
    commands/
    queries/
    ports/
  infrastructure/
    runtime/
    persistence/
```

Presentation : `src/presentation/dom/.../NewsPanel` (hors BC).

---

## 9. Phasage

| Phase | Livrable | Dépendances |
|-------|----------|-------------|
| **0** | Spec (ce dossier) | — |
| **1** | Persist `NewsItem` + **NewsEventModal** (**Lire le suivant** + pause) + génération `city` + onglet Archives admin | Ports Housing/Employment ; `PopupManager` / pause ; UI admin |
| **2** | Canal `caravan` : gates ; unpaid ; **Payer** / **Lire d’autres nouvelles** (delete) ; archive après lecture | Commerce + Accounting + Supply barn |
| **3** | Conseillers | Admin rôles + Gameplay (annonce seule) |
| **4** | `scholar_idea` → hook innovations | Futur BC / skill tree |
| **5** | Espions / diplomates | Contenu + gates dédiés |

---

## 10. Questions encore ouvertes (mineures)

1. Teaser caravane : texte générique vs extrait du titre ?
2. Ordre de génération / file vs désastres Gameplay ; ordre multi-dépêches (`revelation` > …).
3. Filtres / tri dans l’onglet Archives admin (par source, par date) — détail UI.

---

## 11. Décisions validées (ne pas rouvrir sans besoin)

| Sujet | Décision |
|-------|----------|
| Paiement | **À la dépêche**, pas d’abonnement |
| Modale | **Event-message only** (file incoming) — pas d’archives dedans |
| Archives | **Nouvel onglet** du panneau **administrateur** |
| CTA file | Toujours **Lire le suivant** (dernier = archive + ferme) |
| Contribution | **Payer** (+ hint fonds) + **Lire d’autres nouvelles** |
| Ne pas payer | **Delete** définitif — plus jamais accessible |
| Payer | `revealed` puis archive admin après **Lire le suivant** |

---

## 12. Hors périmètre explicite


- Appliquer dégâts / bonus depuis une dépêche (→ Gameplay).
- Négociation diplomatique (→ futur).
- Chat multijoueur / news réseau.
- Remplacer le journal comptable ou le tracker d’objectifs.
