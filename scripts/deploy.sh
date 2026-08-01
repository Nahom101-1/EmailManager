#!/usr/bin/env bash
# Deploy LifeOS to a remote server.
# Usage: SERVER=user@yourserver.com bash scripts/deploy.sh
set -euo pipefail

SERVER="${SERVER:?Set SERVER=user@host}"
REMOTE_DIR="/opt/lifeos"

echo "==> Building standalone bundle..."
npm run build

echo "==> Syncing to $SERVER:$REMOTE_DIR ..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR/data"

rsync -az --delete \
  .next/standalone/ \
  "$SERVER:$REMOTE_DIR/"

rsync -az \
  .next/static \
  "$SERVER:$REMOTE_DIR/.next/"

rsync -az \
  public/ \
  "$SERVER:$REMOTE_DIR/public/"

rsync -az \
  ecosystem.config.cjs \
  "$SERVER:$REMOTE_DIR/"

echo "==> Restarting app..."
ssh "$SERVER" "cd $REMOTE_DIR && pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs"

echo "==> Done. App running at $SERVER."
