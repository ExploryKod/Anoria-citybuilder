# Plan : mettre Anoria en ligne sur un VPS OVHcloud

But : tester le jeu sur Internet (aujourd'hui seulement `localhost`), sur un VPS OVHcloud avec un nom de domaine OVHcloud et un certificat SSL Let's Encrypt (certbot, gratuit).

**Quand** : après la finition de la comptabilité sur la branche `feature/transactions`. Le déploiement part d'une **branche de release** créée ensuite, pas de la branche de travail.

## 1. Ce que le dépôt dit

- **Le jeu est un site statique.** Le build Vite (`pnpm run build`, dossier `dist`) pèse environ 48 Mo, surtout des modèles, textures et images. Il n'a besoin d'aucun serveur applicatif aujourd'hui.
- **Les sauvegardes de partie sont dans le navigateur (IndexedDB, Dexie).** Elles sont propres à chaque navigateur et à chaque nom de domaine : sur le nouveau domaine, les parties de `localhost` ne suivent pas, et effacer les données du site efface la partie. À dire aux testeurs.
- **Un serveur de salles existe** (`server/` : WebSocket, Docker, `nginx-websocket.conf`, PM2, Traefik). Un VPS peut l'héberger plus tard.
- **Le jeu était configuré pour Vercel** (`vercel.json`, hébergement désormais désactivé) : réécritures d'URL (`/game/:hamletId` vers `game.html`, `/missions`, `/settings`, `/privacy`, `/terms`, `/legal`, `/credits`, `/assets`), en-têtes de sécurité, en-têtes de cache, et une politique CSP qui cite `anoria.vercel.app` et une adresse IP.

## 2. Pourquoi un VPS

| Option | Pour | Contre |
|---|---|---|
| Object storage OVH (statique) | Le moins cher | Pas de réécritures ni d'en-têtes à notre main ; coincé si on ajoute une base, des sauvegardes, le serveur de salles |
| Public Cloud (à la demande) | Souple | Dépenses moins prévisibles (trafic sortant, instantanés) |
| **VPS** | Prix fixe par mois, nginx complet, peut accueillir une base et le serveur de salles | On administre le serveur (sécurité, mises à jour) |

Vercel est désactivé (le jeu n'y est plus servi) et il n'y a pas d'autre joueur pour l'instant : le VPS est le seul hébergement, choisi pour l'évolution prévue (base de données, sauvegardes, salles). Cloudflare Pages (gratuit) resterait une solution de secours pour du statique seul.

## 3. Choix du VPS

- **Taille** : statique seul, 1 à 2 vCores et 2 Go de RAM suffisent. Avec une base et le serveur de salles, viser 4 Go. Prendre le plus petit modèle de la gamme actuelle, qu'on agrandit ensuite.
- **Prix** : ils ont beaucoup bougé en 2026 et les sources se contredisent (le VPS-1 serait passé d'environ 5,39 € à 7,79 € par mois hors remise ; le VPS-2 est donné vers 10 € par mois avec 6 cœurs, 12 Go, trafic illimité). **À vérifier sur la page officielle OVHcloud avant de commander.**
- **Zone** : Europe. **Système** : Debian 12 ou Ubuntu 24.04 LTS.
- À regarder au moment de commander : la bande passante, le trafic inclus, la possibilité de monter en gamme, l'option de sauvegarde automatique.

Sources : digitiz.fr (hausse des prix VPS 2026), vpsbenchmarks.com (fiche VPS-2), next.ink (hausse OVHcloud).

## 4. Ce qu'il faut adapter dans le projet

À faire sur la branche de release (rien n'est fait à ce jour) :

0. **`vercel.json`** : devenu inutile (Vercel désactivé) ; le garder comme référence pour la configuration nginx, puis le retirer de la branche de release.
1. **nginx** : refaire les réécritures d'URL et les en-têtes de `vercel.json` (sécurité, cache `immutable` des fichiers à empreinte, `noindex` pendant le test).
2. **CSP** : remplacer `anoria.vercel.app` et l'adresse IP par le domaine ; le serveur de salles passe en `wss://` sur le domaine, derrière nginx.
3. **HSTS** : ne pas mettre `preload` (ni `includeSubDomains` sans y penser) tant que le domaine n'est pas stable.
4. **Compression** : brotli ou gzip, HTTP/2 ; le premier chargement de 48 Mo en dépend.
5. **Service worker / PWA** (`pwabuilder-sw.js`, `pwa-assets.config.js`) : vérifier qu'ils ne servent pas une ancienne version après une mise en ligne.
6. **Variables d'environnement** : `.env` (jours par mois, etc.) fixé pour le build de release, car `VITE_DAYS_PER_MONTH` entre dans le build.

## 5. Étapes

### A. Avant la mise en ligne
1. Finir la comptabilité sur `feature/transactions` (paie à la source, créance de la ville, compte de résultat et bilan M57 de la ville).
2. Créer la branche `release/ovh` depuis cette branche, une fois les tests au vert.
3. Y ajouter un dossier `deploy/` : configuration nginx, CSP adaptée, script de déploiement.

### B. Le serveur
1. Commander le VPS et le nom de domaine ; faire pointer le domaine (enregistrements A, et AAAA si IPv6) vers le VPS.
2. Première connexion : utilisateur non root, SSH par clé uniquement, mot de passe désactivé.
3. Pare-feu (`ufw` : 22, 80, 443), `fail2ban`, mises à jour automatiques de sécurité.
4. Installer nginx, puis certbot (greffon nginx) ; vérifier le renouvellement automatique (`certbot renew --dry-run`).

### C. Le déploiement
1. Construire le site (`pnpm run build`) sur la branche de release.
2. Copier `dist` vers le serveur (`rsync`), dans un dossier daté, puis basculer un lien symbolique : retour arrière immédiat en cas de problème.
3. Vérifier : toutes les pages et réécritures, les en-têtes (`curl -I`), le certificat, le chargement complet du jeu, une partie créée puis rechargée.

### D. Ensuite (si besoin)
- **Cloudflare gratuit devant le VPS** : il sert les gros fichiers statiques depuis son cache et allège la bande passante.
- **Serveur de salles** : le lancer sur le VPS (Docker ou PM2), derrière nginx en `wss://`.
- **Base de données et sauvegardes** : `pg_dump` planifié vers un object storage OVH (quelques centimes par mois), en plus de l'option de sauvegarde du VPS.

## 6. Points d'attention

- Une partie jouée sur le domaine reste dans le navigateur du joueur : prévoir à terme un export ou une sauvegarde côté serveur.
- Le jeu n'a aucun chemin de migration : une partie enregistrée avant une version peut ne plus se charger. Sans autre joueur pour l'instant, rien n'est à préserver ; à annoncer aux premiers testeurs que leurs parties peuvent être remises à zéro.
- Garder `noindex` tant que le jeu n'est pas prêt à être référencé.
- Ne jamais mettre de secret (clé, mot de passe) dans la branche de release.

## 7. À décider

- [ ] Nom de domaine.
- [ ] Modèle de VPS (voir §3, après vérification des prix).
- [ ] Cloudflare devant le VPS, oui ou non.
- [ ] Faut-il lancer le serveur de salles dès la première mise en ligne ?
