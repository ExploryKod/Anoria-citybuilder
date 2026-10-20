#!/usr/bin/env bash
# Builds the game here and publishes it to the VPS: a dated folder, then the `current` link is switched to it.
# Going back is one command: point `current` at an older folder of /var/www/anoria/releases.
# Usage (from the repository root): bash deploy/deploy.sh
set -euo pipefail

HOST=anoria-deploy   # the Host alias of ~/.ssh/config: the deployment user (anideploy) and its own key
RELEASE=$(date +%Y-%m-%d-%H%M)
KEEP=2

pnpm install --frozen-lockfile
pnpm run build

# --link-dest: a file that did not change since the live release is linked, not sent again nor stored twice (a release then costs only what changed).
# The kits' source archives (*.zip) are never loaded by the game: they are not published.
rsync -az --delete --exclude='*.zip' --link-dest=/var/www/anoria/current/ dist/ "$HOST:/var/www/anoria/releases/$RELEASE/"
ssh "$HOST" "ln -sfn /var/www/anoria/releases/$RELEASE /var/www/anoria/current && ls -1dt /var/www/anoria/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf"

echo "Published $RELEASE"
