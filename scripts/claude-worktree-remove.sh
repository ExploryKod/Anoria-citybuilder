#!/usr/bin/env bash
# WorktreeRemove hook: removes a worktree made by claude-worktree-create.sh and its branch.
# Strict: uncommitted changes (worktree remove) or unmerged commits (branch -d) make it fail, so nothing is lost.
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:?CLAUDE_PROJECT_DIR is not set}"
WORKTREE="$(jq -er .worktree_path)"
BRANCH="$(git -C "$WORKTREE" symbolic-ref --short HEAD)"

git -C "$ROOT" worktree remove "$WORKTREE" >&2
git -C "$ROOT" branch -d "$BRANCH" >&2
