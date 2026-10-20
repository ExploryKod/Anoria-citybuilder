# Security Policy

Thank you for helping keep Anoria and its players safe.

## Supported versions

Anoria is a continuously deployed web game (with an Android wrapper built from the same code). Only the
latest release on the `main` branch, as deployed on the production site, receives security fixes. Older
releases and forks are not maintained.

| Version                               | Supported |
| ------------------------------------- | --------- |
| Latest production release (`main`)    | Yes       |
| `develop` and feature branches        | Best effort, no guarantee |
| Anything older                        | No        |

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for a security problem.**

Report it privately by either:

1. Using GitHub's private reporting: the **Security** tab of the repository, then **Report a vulnerability**
   (if it is enabled), or
2. Emailing **amauryproject.slum874@passinbox.com** with the subject `[SECURITY] Anoria: <short summary>`.

Please include, as far as you can:

- What the issue is and which component it affects (client game, rooms/WebSocket server, deployment, Android app).
- Steps to reproduce, or a proof of concept, and the browser / OS / app version used.
- The impact you expect (what an attacker could read, change or break).
- Whether you want to be credited, and under which name.

Do not include real personal data of other people in your report.

### What to expect

This is a small, independently run project, so these are targets rather than guarantees:

- Acknowledgement of your report within **5 working days**.
- An initial assessment (accepted, needs more information, or out of scope) within **14 days**.
- A fix or mitigation for confirmed issues as soon as reasonably possible, prioritised by severity.
- Credit in the release notes if you wish, once the fix is deployed.

Please give us a reasonable time to fix the issue before any public disclosure (we ask for up to **90 days**,
and will tell you if we need longer).

## Scope

In scope:

- The Anoria web client (game, editor, settings, missions and other pages served from the production site).
- The multiplayer / rooms WebSocket server in `server/`.
- The deployment configuration in `deploy/` and `server/` (nginx, Docker, Traefik) when it exposes a weakness.
- The Android wrapper (Capacitor) built from this repository.
- Cross-site scripting, injection, authentication or authorisation flaws, unsafe handling of imported files
  (city exports, prefabs, mission maps), leaks of secrets or personal data, and weaknesses in the WebSocket protocol.

Out of scope:

- Anything that only affects a player's own local data in their own browser (the game state lives in the
  browser's IndexedDB, and a player editing it only cheats at their own single-player game).
- Denial of service by sheer volume of traffic, and automated scanner output with no demonstrated impact.
- Social engineering, physical attacks, or attacks on third-party services (hosting provider, GitHub, CDNs)
  or on vulnerabilities in dependencies with no demonstrable impact on Anoria; report those upstream.
- Missing best-practice headers or settings without a concrete, exploitable consequence.
- Outdated browsers or devices that no longer receive vendor security updates.

## Safe harbour

If you act in good faith, stay within the scope above, avoid privacy violations, data destruction and service
disruption, only test with your own data and accounts, and report the issue privately, we will not pursue or
support legal action against you for your research.

## Handling secrets and data

- No secrets (API keys, server credentials, SSL private keys, `.env` values) belong in this repository.
  If you find one committed, report it as above so it can be rotated; do not use it.
- Personal-data practices are described in the site's privacy page (`privacy.html`).

## For contributors

- Never commit credentials, certificates or `.env` files; keep them out of Git and out of the built `dist/`.
- Treat everything imported into the game (saved cities, prefabs, mission maps, WebSocket messages) as untrusted:
  validate it and fail loudly on malformed input, and never insert it into the page as raw HTML.
- Keep dependencies current (`pnpm-lock.yaml` is committed) and review advisories (`pnpm audit`) before releases.
