#!/usr/bin/env bash
# WorktreeCreate hook: a Claude Code worktree is a parallel copy of the game to work in while the main checkout keeps running.
#   claude --worktree commerce-export-tax
# - branch `commerce-export-tax`, started from the branch checked out in the main checkout (its committed HEAD,
#   so uncommitted changes of the main checkout are NOT in it);
# - the untracked env files are copied, plus its own node_modules;
# - its own dev port (first free one from 5174, written as VITE_DEV_PORT in its .env.local, read by vite.config.js),
#   so `pnpm dev` there never collides with the main checkout on 5173.
# Stdout carries ONLY the worktree path; everything else goes to stderr.
# Strict on purpose: detached HEAD, missing .env / .env.local, a branch name already used => the script fails.
set -euo pipefail
export GIT_TERMINAL_PROMPT=0

ROOT="${CLAUDE_PROJECT_DIR:?CLAUDE_PROJECT_DIR is not set}"
NAME="$(jq -er .name)"
DIR="$ROOT/.claude/worktrees/$NAME"

BASE="$(git -C "$ROOT" symbolic-ref --short HEAD)"
git -C "$ROOT" worktree add -b "$NAME" "$DIR" "$BASE" >&2

# First port from 5174 that no running server listens on and no other worktree already pinned.
PORT=5174
while ss -ltn | grep -q ":$PORT " || grep -qs "^VITE_DEV_PORT=$PORT\$" "$ROOT"/.claude/worktrees/*/.env.local; do
  PORT=$((PORT + 1))
done

cp "$ROOT/.env" "$DIR/.env" >&2
grep -v '^VITE_DEV_PORT=' "$ROOT/.env.local" > "$DIR/.env.local" || test $? -eq 1
echo "VITE_DEV_PORT=$PORT" >> "$DIR/.env.local"

(cd "$DIR" && pnpm install --frozen-lockfile) >&2

echo "Worktree '$NAME' from '$BASE': run \`pnpm dev\` there, http://localhost:$PORT" >&2
echo "$DIR"
