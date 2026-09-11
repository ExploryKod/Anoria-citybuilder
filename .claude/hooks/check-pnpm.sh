#!/usr/bin/env bash
# PreToolUse guard (Bash): force pnpm installs through Socket Firewall (sfw).
# Blocks bare `pnpm add|install|update|dlx ...` and tells the caller to
# rerun it as `sfw pnpm ...`. Read-only/run commands (pnpm run/test/build/...)
# are left alone.
set -euo pipefail

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

if [ -z "$command" ]; then
  exit 0
fi

# Already routed through Socket Firewall — let it through.
if printf '%s' "$command" | grep -Eq '(^|[;&|]|[[:space:]])sfw[[:space:]]+pnpm[[:space:]]+(add|install|update|dlx)\b'; then
  exit 0
fi

if printf '%s' "$command" | grep -Eq '(^|[;&|]|[[:space:]])pnpm[[:space:]]+(add|install|update|dlx)\b'; then
  echo "Commande bloquée : utilise Socket Firewall avec sfw pnpm ..." >&2
  exit 2
fi

exit 0
